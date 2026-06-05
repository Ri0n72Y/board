import { describe, expect, it } from 'vitest'
import { getConfiguredTags } from '../config/boardConfigTools.js'
import {
  loadLegalMockBoardConfig,
  loadLegalMockRecords,
} from './legalMockBoard.js'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('legal mocked board fixture', () => {
  it('uses complete repository seed records with stable ids and pids', async () => {
    const records = await loadLegalMockRecords()
    const ids = new Set<string>()
    const pids = new Set<string>()

    expect(records).toHaveLength(33)

    records.forEach((record, index) => {
      expect(record.id).toMatch(uuidPattern)
      expect(ids.has(record.id)).toBe(false)
      ids.add(record.id)

      expect(record.pid).toBe(`CARD-${index + 1}`)
      expect(pids.has(record.pid)).toBe(false)
      pids.add(record.pid)

      expect(record.schema).toBe('CardBody')
      expect(record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(record.createdBy).toBeTruthy()
    })
  })

  it('keeps board pid.nextNumber aligned with the highest mocked pid', async () => {
    const records = await loadLegalMockRecords()
    const config = await loadLegalMockBoardConfig()
    const maxPid = Math.max(
      ...records.map((record) => Number(record.pid.replace('CARD-', '')))
    )

    expect(config.pid.nextNumber).toBe(maxPid + 1)
  })

  it('uses configured tags and resolvable UUID relation targets', async () => {
    const records = await loadLegalMockRecords()
    const config = await loadLegalMockBoardConfig()
    const configuredTags = getConfiguredTags(config)
    const ids = new Set(records.map((record) => record.id))

    for (const record of records) {
      for (const tag of record.tags) {
        expect(configuredTags.has(tag)).toBe(true)
      }

      for (const relation of record.relations ?? []) {
        expect(relation.target).toMatch(uuidPattern)
        expect(ids.has(relation.target)).toBe(true)
        expect(relation.target).not.toMatch(/^US-/)
        expect(relation.target).not.toMatch(/^CARD-\d+$/)
      }
    }
  })

  it('stores readable UTF-8 Chinese text instead of escaped or mojibake text', async () => {
    const records = await loadLegalMockRecords()
    const serialized = JSON.stringify(records)

    expect(records[0].body.title).toContain('初始化 Unity 项目')
    expect(records[4].body.title).toContain('玩家抽牌')
    expect(serialized).not.toMatch(/\\u[0-9a-fA-F]{4}/)
    expect(serialized).not.toContain('鍒')
    expect(serialized).not.toContain('鐜')
  })
})
