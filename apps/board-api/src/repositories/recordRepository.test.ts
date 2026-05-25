import type { Collection, Document } from 'mongodb'
import { describe, expect, it } from 'vitest'
import {
  MemoryRecordRepository,
  MongoRecordRepository,
  type BoardRecord,
} from './recordRepository.js'

const BASE_RECORD: BoardRecord = {
  id: 'record-1',
  pid: 'CARD-1',
  schema: 'CardBody',
  tags: ['status:todo'],
  body: { title: 'Repository card' },
}

describe('MemoryRecordRepository', () => {
  it('creates, lists, finds, and updates records', async () => {
    const repository = new MemoryRecordRepository()

    await repository.create(BASE_RECORD)

    await expect(
      repository.list({ includeArchived: false, excludeTags: ['status:archived'] })
    ).resolves.toEqual([BASE_RECORD])
    await expect(repository.findById(BASE_RECORD.id)).resolves.toEqual(
      BASE_RECORD
    )
    await expect(
      repository.update(BASE_RECORD.id, {
        tags: ['status:wip'],
        body: { description: 'Updated' },
      })
    ).resolves.toMatchObject({
      id: BASE_RECORD.id,
      tags: ['status:wip'],
      body: {
        title: 'Repository card',
        description: 'Updated',
      },
    })
    await expect(repository.update('missing', {})).resolves.toBeNull()
  })

  it('filters excluded snapshot tags unless archived records are requested', async () => {
    const repository = new MemoryRecordRepository()
    const archived = {
      ...BASE_RECORD,
      id: 'record-2',
      pid: 'CARD-2',
      tags: ['status:archived'],
    } satisfies BoardRecord

    await repository.create(BASE_RECORD)
    await repository.create(archived)

    await expect(
      repository.list({ includeArchived: false, excludeTags: ['status:archived'] })
    ).resolves.toEqual([BASE_RECORD])
    await expect(
      repository.list({ includeArchived: true, excludeTags: ['status:archived'] })
    ).resolves.toEqual([BASE_RECORD, archived])
  })
})

describe('MongoRecordRepository', () => {
  it('uses configured exclude tags when listing current records', async () => {
    const findCalls: unknown[] = []
    const repository = new MongoRecordRepository(
      createCollectionStub({
        find(filter: unknown) {
          findCalls.push(filter)
          return {
            toArray: async () => [{ ...BASE_RECORD, _id: 'mongo-id' }],
          }
        },
      })
    )

    await expect(
      repository.list({ includeArchived: false, excludeTags: ['status:archived'] })
    ).resolves.toEqual([BASE_RECORD])
    expect(findCalls).toEqual([
      {
        tags: {
          $nin: ['status:archived'],
        },
      },
    ])
  })

  it('creates, finds, and updates records through the collection', async () => {
    const inserted: unknown[] = []
    const replacements: unknown[] = []
    const repository = new MongoRecordRepository(
      createCollectionStub({
        insertOne(record: unknown) {
          inserted.push(record)
          return Promise.resolve()
        },
        findOne() {
          return Promise.resolve({ ...BASE_RECORD, _id: 'mongo-id' })
        },
        findOneAndReplace(filter: unknown, replacement: unknown) {
          replacements.push({ filter, replacement })
          return Promise.resolve({ ...(replacement as BoardRecord), _id: 'mongo-id' })
        },
      })
    )

    await expect(repository.create(BASE_RECORD)).resolves.toEqual(BASE_RECORD)
    expect(inserted).toEqual([BASE_RECORD])

    await expect(repository.findById(BASE_RECORD.id)).resolves.toEqual(BASE_RECORD)

    await expect(
      repository.update(BASE_RECORD.id, { assignee: 'member-1' })
    ).resolves.toMatchObject({ assignee: 'member-1' })
    expect(replacements).toHaveLength(1)
  })
})

function createCollectionStub(
  methods: Record<string, unknown>
): Collection<BoardRecord & Document> {
  return methods as unknown as Collection<BoardRecord & Document>
}
