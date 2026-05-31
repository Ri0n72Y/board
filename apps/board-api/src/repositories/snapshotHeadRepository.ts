import type {
  ClientSession,
  Collection,
  Document,
  Filter,
  MongoClient,
  OptionalId,
} from 'mongodb'
import type {
  DeepPartial,
  PatchItem,
  PublicKey,
  RecordBody,
  RecordId,
} from '@labour-board/shared'

export type StoredPatchDoc = PatchItem<DeepPartial<RecordBody>> & {
  createdBy: PublicKey
  createdAt: string
}

export interface SnapshotHead {
  kind: 'snapshotHead'
  version: number
  records: Record<RecordId, { lastPatchId: RecordId | null }>
}

export interface AppendPatchParams {
  targetId: RecordId
  patch: StoredPatchDoc
  expectedSnapshotVersion: number
  expectedParentId: RecordId | null
}

export type AppendPatchResult =
  | {
      ok: true
      patch: StoredPatchDoc
      newSnapshotVersion: number
    }
  | {
      ok: false
      reason: 'snapshotVersionMismatch'
      currentVersion: number
    }
  | {
      ok: false
      reason: 'parentMismatch'
      currentParentId: RecordId | null
    }
  | {
      ok: false
      reason: 'parentPatchMissing'
      parentId: RecordId
    }
  | {
      ok: false
      reason: 'parentPatchTargetMismatch'
      parentId: RecordId
      parentTargetId: RecordId
    }

export interface PatchFactRepository {
  appendPatch(patch: StoredPatchDoc): Promise<StoredPatchDoc>
  findPatchById(id: string): Promise<StoredPatchDoc | null>
  listPatches(): Promise<StoredPatchDoc[]>
}

export interface SnapshotHeadRepository {
  loadSnapshotHead(): Promise<SnapshotHead>
  rebuildSnapshotHeadFromPatches(patches: StoredPatchDoc[]): SnapshotHead
  appendPatchAndAdvanceHead(
    params: AppendPatchParams
  ): Promise<AppendPatchResult>
}

function emptyHead(): SnapshotHead {
  return { kind: 'snapshotHead', version: 0, records: {} }
}

function cleanPatch(doc: Document): StoredPatchDoc {
  return {
    id: doc.id,
    pid: doc.pid,
    schema: doc.schema,
    targetId: doc.targetId,
    parentId: doc.parentId ?? null,
    tags: doc.tags,
    assignee: doc.assignee,
    body: doc.body,
    assets: doc.assets,
    relations: doc.relations,
    description: doc.description,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
  }
}

function patchOnlyFilter(extra?: Filter<Document>): Filter<Document> {
  const conditions: Filter<Document>[] = [{ targetId: { $exists: true } }]
  if (extra && Object.keys(extra).length > 0) {
    conditions.push(extra)
  }
  return { $and: conditions } as Filter<Document>
}

function snapshotHeadFilter(): Filter<Document> {
  return { kind: 'snapshotHead' }
}

function assertValidHead(head: SnapshotHead): void {
  if (head.kind !== 'snapshotHead') {
    throw new SnapshotHeadIntegrityError('Snapshot head kind must be snapshotHead')
  }
}

function cloneHead(head: SnapshotHead): SnapshotHead {
  return structuredClone(head)
}

export class SnapshotHeadIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SnapshotHeadIntegrityError'
  }
}

class SnapshotHeadTransactionAbort extends Error {
  readonly result: AppendPatchResult
  constructor(result: AppendPatchResult) {
    super('Snapshot head transaction aborted')
    this.name = 'SnapshotHeadTransactionAbort'
    this.result = result
  }
}

export class MemorySnapshotHeadRepository implements SnapshotHeadRepository {
  private snapshotHead: SnapshotHead | null = null
  private readonly patchFacts: PatchFactRepository
  private appendLock: Promise<void> = Promise.resolve()

  constructor(patchFacts: PatchFactRepository) {
    this.patchFacts = patchFacts
  }

  async loadSnapshotHead(): Promise<SnapshotHead> {
    if (this.snapshotHead) {
      return cloneHead(this.snapshotHead)
    }

    const rebuilt = this.rebuildSnapshotHeadFromPatches(
      await this.patchFacts.listPatches()
    )
    await this.saveInitialSnapshotHead(rebuilt)
    return cloneHead(rebuilt)
  }

  private async saveInitialSnapshotHead(head: SnapshotHead): Promise<void> {
    assertValidHead(head)
    if (!this.snapshotHead) {
      this.snapshotHead = cloneHead(head)
    }
  }

  rebuildSnapshotHeadFromPatches(patches: StoredPatchDoc[]): SnapshotHead {
    return rebuildSnapshotHeadFromPatches(patches)
  }

  async appendPatchAndAdvanceHead(
    params: AppendPatchParams
  ): Promise<AppendPatchResult> {
    return this.withAppendLock(async () => {
      const head = await this.loadSnapshotHead()
      const validation = await validateAppend(params, head, this.patchFacts)
      if (!validation.ok) {
        return validation
      }

      await this.patchFacts.appendPatch(params.patch)
      const nextHead = nextSnapshotHead(head, params.targetId, params.patch.id)
      this.snapshotHead = nextHead
      return {
        ok: true,
        patch: params.patch,
        newSnapshotVersion: nextHead.version,
      }
    })
  }

  private async withAppendLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.appendLock
    let release: () => void = () => {}
    this.appendLock = new Promise<void>((resolve) => {
      release = resolve
    })

    await previous
    try {
      return await operation()
    } finally {
      release()
    }
  }
}

export class MongoSnapshotHeadRepository implements SnapshotHeadRepository {
  private readonly client: MongoClient
  private readonly recordsCollection: Collection<Document>
  private readonly snapshotsCollection: Collection<Document>

  constructor(
    client: MongoClient,
    recordsCollection: Collection<Document>,
    snapshotsCollection: Collection<Document>
  ) {
    this.client = client
    this.recordsCollection = recordsCollection
    this.snapshotsCollection = snapshotsCollection
  }

  async loadSnapshotHead(): Promise<SnapshotHead> {
    const stored = await this.findStoredHead()
    if (stored) {
      return stored
    }

    const patches = await this.loadPatchFacts()
    const rebuilt = this.rebuildSnapshotHeadFromPatches(patches)
    await this.saveInitialSnapshotHead(rebuilt)
    return rebuilt
  }

  private async saveInitialSnapshotHead(head: SnapshotHead): Promise<void> {
    assertValidHead(head)
    try {
      await this.snapshotsCollection.insertOne(toSnapshotDoc(head))
    } catch (caught) {
      if (!isDuplicateKeyError(caught)) {
        throw caught
      }
    }
  }

  rebuildSnapshotHeadFromPatches(patches: StoredPatchDoc[]): SnapshotHead {
    return rebuildSnapshotHeadFromPatches(patches)
  }

  async appendPatchAndAdvanceHead(
    params: AppendPatchParams
  ): Promise<AppendPatchResult> {
    const session = this.client.startSession()
    try {
      return await session.withTransaction(async () => {
        let head = await this.findStoredHead(session)
        if (!head) {
          const patches = await this.loadPatchFacts(session)
          head = this.rebuildSnapshotHeadFromPatches(patches)
          try {
            await this.snapshotsCollection.insertOne(toSnapshotDoc(head), {
              session,
            })
          } catch (caught) {
            if (isDuplicateKeyError(caught)) {
              throw new SnapshotHeadTransactionAbort({
                ok: false,
                reason: 'snapshotVersionMismatch',
                currentVersion: head.version,
              })
            }
            throw caught
          }
        }

        const validation = await validateAppend(
          params,
          head,
          this.mongoPatchFacts(session)
        )
        if (!validation.ok) {
          throw new SnapshotHeadTransactionAbort(validation)
        }

        await this.recordsCollection.insertOne(
          params.patch as OptionalId<Document>,
          { session }
        )
        const nextHead = nextSnapshotHead(
          head,
          params.targetId,
          params.patch.id
        )
        const replaced = await this.snapshotsCollection.findOneAndReplace(
          {
            kind: 'snapshotHead',
            version: head.version,
          },
          toSnapshotDoc(nextHead),
          { returnDocument: 'before', session }
        )
        if (!replaced) {
          throw new SnapshotHeadTransactionAbort({
            ok: false,
            reason: 'snapshotVersionMismatch',
            currentVersion: head.version,
          })
        }

        return {
          ok: true,
          patch: params.patch,
          newSnapshotVersion: nextHead.version,
        }
      })
    } catch (caught) {
      if (caught instanceof SnapshotHeadTransactionAbort) {
        return caught.result
      }
      throw caught
    } finally {
      await session.endSession()
    }
  }

  private async findStoredHead(
    session?: ClientSession
  ): Promise<SnapshotHead | null> {
    const doc = await this.snapshotsCollection.findOne(snapshotHeadFilter(), {
      session,
    })
    return doc ? fromSnapshotDoc(doc) : null
  }

  private async loadPatchFacts(
    session?: ClientSession
  ): Promise<StoredPatchDoc[]> {
    const docs = await this.recordsCollection
      .find(patchOnlyFilter(), { session })
      .toArray()
    return docs.map(cleanPatch)
  }

  private mongoPatchFacts(session: ClientSession): PatchFactRepository {
    return {
      appendPatch: async (patch) => {
        await this.recordsCollection.insertOne(patch as OptionalId<Document>, {
          session,
        })
        return patch
      },
      findPatchById: async (id) => {
        const doc = await this.recordsCollection.findOne(
          patchOnlyFilter({ id }),
          { session }
        )
        return doc ? cleanPatch(doc) : null
      },
      listPatches: async () => this.loadPatchFacts(session),
    }
  }
}

async function validateAppend(
  params: AppendPatchParams,
  head: SnapshotHead,
  patchFacts: Pick<PatchFactRepository, 'findPatchById'>
): Promise<AppendPatchResult | { ok: true }> {
  if (params.expectedSnapshotVersion !== head.version) {
    return {
      ok: false,
      reason: 'snapshotVersionMismatch',
      currentVersion: head.version,
    }
  }

  const currentParentId = head.records[params.targetId]?.lastPatchId ?? null
  if (params.expectedParentId !== currentParentId) {
    return {
      ok: false,
      reason: 'parentMismatch',
      currentParentId,
    }
  }

  if (params.expectedParentId !== null) {
    const parentPatch = await patchFacts.findPatchById(params.expectedParentId)
    if (!parentPatch) {
      return {
        ok: false,
        reason: 'parentPatchMissing',
        parentId: params.expectedParentId,
      }
    }
    if (parentPatch.targetId !== params.targetId) {
      return {
        ok: false,
        reason: 'parentPatchTargetMismatch',
        parentId: params.expectedParentId,
        parentTargetId: parentPatch.targetId,
      }
    }
  }

  return { ok: true }
}

function rebuildSnapshotHeadFromPatches(patches: StoredPatchDoc[]): SnapshotHead {
  if (patches.length === 0) {
    return emptyHead()
  }

  const byId = new Map<RecordId, StoredPatchDoc>()
  for (const patch of patches) {
    if (byId.has(patch.id)) {
      throw new SnapshotHeadIntegrityError(`Duplicate patch id: ${patch.id}`)
    }
    byId.set(patch.id, patch)
  }

  const childrenByParent = new Map<RecordId, StoredPatchDoc[]>()
  const rootsByTarget = new Map<RecordId, StoredPatchDoc[]>()
  for (const patch of patches) {
    if (patch.parentId === null) {
      const roots = rootsByTarget.get(patch.targetId) ?? []
      roots.push(patch)
      rootsByTarget.set(patch.targetId, roots)
      continue
    }

    const parent = byId.get(patch.parentId)
    if (!parent) {
      throw new SnapshotHeadIntegrityError(
        `Patch ${patch.id} parent ${patch.parentId} does not exist`
      )
    }
    if (parent.targetId !== patch.targetId) {
      throw new SnapshotHeadIntegrityError(
        `Patch ${patch.id} parent ${patch.parentId} belongs to target ${parent.targetId}`
      )
    }
    const children = childrenByParent.get(patch.parentId) ?? []
    children.push(patch)
    childrenByParent.set(patch.parentId, children)
  }

  for (const [parentId, children] of childrenByParent) {
    if (children.length > 1) {
      throw new SnapshotHeadIntegrityError(
        `Patch parent ${parentId} has multiple children`
      )
    }
  }

  const targets = new Set(patches.map((patch) => patch.targetId))
  const records: SnapshotHead['records'] = {}
  for (const targetId of targets) {
    const roots = rootsByTarget.get(targetId) ?? []
    if (roots.length !== 1) {
      throw new SnapshotHeadIntegrityError(
        `Target ${targetId} must have exactly one root patch`
      )
    }

    let current = roots[0]
    const seen = new Set<RecordId>()
    while (current) {
      if (seen.has(current.id)) {
        throw new SnapshotHeadIntegrityError(
          `Patch chain for target ${targetId} contains a cycle`
        )
      }
      seen.add(current.id)
      const children = childrenByParent.get(current.id) ?? []
      if (children.length === 0) {
        records[targetId] = { lastPatchId: current.id }
        break
      }
      current = children[0]
    }
  }

  return {
    kind: 'snapshotHead',
    version: patches.length,
    records,
  }
}

function nextSnapshotHead(
  head: SnapshotHead,
  targetId: RecordId,
  patchId: RecordId
): SnapshotHead {
  return {
    kind: 'snapshotHead',
    version: head.version + 1,
    records: {
      ...head.records,
      [targetId]: { lastPatchId: patchId },
    },
  }
}

function toSnapshotDoc(head: SnapshotHead): OptionalId<Document> {
  return {
    kind: 'snapshotHead',
    version: head.version,
    records: head.records,
  }
}

function fromSnapshotDoc(doc: Document): SnapshotHead {
  return {
    kind: 'snapshotHead',
    version: doc.version as number,
    records: (doc.records as SnapshotHead['records']) ?? {},
  }
}

function isDuplicateKeyError(caught: unknown): boolean {
  return (
    typeof caught === 'object' &&
    caught !== null &&
    'code' in caught &&
    (caught as { code?: unknown }).code === 11000
  )
}
