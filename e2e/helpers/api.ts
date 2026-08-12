import type { APIRequestContext } from '@playwright/test'

export const API_BASE = 'http://localhost:8787/api/v0'

export interface RecordItem {
  id: string
  pid: string
  schema: string
  tags: string[]
  assignee?: string | null
  body: { title?: string; description?: string; content?: string }
  assets?: string[]
  relations?: Array<{ constraint: string; target: string; description?: string }>
}

export class BoardApi {
  constructor(private readonly request: APIRequestContext) {}

  async createRecord(input: {
    schema?: string
    tags?: string[]
    body?: Record<string, unknown>
    assets?: string[]
    relations?: Array<{ constraint: string; target: string; description?: string }>
  }): Promise<RecordItem> {
    const res = await this.request.post(`${API_BASE}/records`, {
      data: {
        schema: input.schema ?? 'CardBody',
        tags: input.tags ?? ['status:todo'],
        body: input.body ?? { title: `record-${Date.now()}` },
        ...(input.assets ? { assets: input.assets } : {}),
        ...(input.relations ? { relations: input.relations } : {}),
      },
    })
    if (!res.ok()) {
      throw new Error(`createRecord failed: ${res.status()} ${await res.text()}`)
    }
    const payload = await res.json()
    return payload.data.body as RecordItem
  }

  async patchRecord(
    recordId: string,
    input: {
      parentId: string
      currentVersion: number
      tagChanges?: { add?: string[]; remove?: string[] }
      body?: Record<string, unknown>
      description?: string
    }
  ): Promise<unknown> {
    const res = await this.request.post(`${API_BASE}/records/${recordId}/patches`, {
      data: input,
    })
    if (!res.ok()) {
      throw new Error(`patchRecord failed: ${res.status()} ${await res.text()}`)
    }
    return res.json()
  }

  async getCurrentBoard(): Promise<{
    records: Array<{ body: RecordItem }>
    snapshotHeadVersion: number
  }> {
    const res = await this.request.get(`${API_BASE}/board/current`)
    if (!res.ok()) {
      throw new Error(`getCurrentBoard failed: ${res.status()} ${await res.text()}`)
    }
    const payload = await res.json()
    return payload.data
  }

  async exportCurrentBoard(): Promise<{ ok: boolean; status: number }> {
    const res = await this.request.get(`${API_BASE}/board/current/export`)
    return { ok: res.ok(), status: res.status() }
  }

  /** Move a record to a new status via a patch (replace status tag). */
  async moveStatus(recordId: string, statusTag: string): Promise<void> {
    // 先取当前 status tag，patch 时 add 新 + remove 旧（看板按第一个 status tag 分组）
    const board = await this.getCurrentBoard()
    const record = board.records.find((r) => r.body.id === recordId)
    const currentStatus = record?.body.tags.find((t) => t.startsWith('status:'))
    // 用 history 接口拿当前版本（seed 无 patch 历史时 parentId=null + currentVersion=0）
    const histRes = await this.request.get(`${API_BASE}/records/${recordId}/history`)
    let parentId: string | null = null
    let currentVersion = 0
    if (histRes.ok()) {
      const hist = await histRes.json()
      const patches = hist.data?.patches ?? []
      const last = patches[patches.length - 1]
      if (last) {
        // history patch 无 version 字段：currentVersion = 链长度（服务端 head.currentVersion）
        parentId = last.body?.id ?? last.id
        currentVersion = patches.length
      }
    }
    await this.patchRecord(recordId, {
      parentId,
      currentVersion,
      tagChanges: {
        add: [statusTag],
        ...(currentStatus && currentStatus !== statusTag ? { remove: [currentStatus] } : {}),
      },
      description: `move to ${statusTag}`,
    })
  }

  async createSnapshot(reason: string): Promise<{ id: string }> {
    const res = await this.request.post(`${API_BASE}/snapshots`, {
      data: { reason },
    })
    if (!res.ok()) {
      throw new Error(`createSnapshot failed: ${res.status()} ${await res.text()}`)
    }
    const payload = await res.json()
    return payload.data.snapshot
  }

  async createAgentDraft(input: {
    title: string
    profile?: string
    source?: string
    contextGoal?: string
  }): Promise<{ id: string; contextMarkdown?: string }> {
    const res = await this.request.post(`${API_BASE}/agent/drafts`, {
      data: {
        title: input.title,
        profile: input.profile ?? 'agent-full',
        source: input.source ?? 'current-board',
        ...(input.contextGoal ? { contextGoal: input.contextGoal } : {}),
      },
    })
    if (!res.ok()) {
      throw new Error(`createAgentDraft failed: ${res.status()} ${await res.text()}`)
    }
    const payload = await res.json()
    return payload.data.draft
  }

  async reviewDraft(draftId: string, status: string): Promise<void> {
    const res = await this.request.patch(`${API_BASE}/agent/drafts/${draftId}/review`, {
      data: { status },
    })
    if (!res.ok()) {
      throw new Error(`reviewDraft failed: ${res.status()} ${await res.text()}`)
    }
  }
}
