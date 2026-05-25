import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { MemoryRecordRepository } from '../repositories/recordRepository.js'
import { RecordService, RecordValidationError } from './recordService.js'

function createService(): RecordService {
  return new RecordService(new MemoryRecordRepository(), DEFAULT_BOARD_CONFIG)
}

describe('RecordService', () => {
  it('creates card and asset records with config-driven public ids', async () => {
    const service = createService()

    const card = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: {
        title: 'Implement inventory board',
      },
    })
    const asset = await service.create({
      schema: 'AssetBody',
      tags: ['status:todo', 'asset:image'],
      body: {
        title: 'Inventory icon',
        uri: 'asset://inventory-icon.png',
      },
    })

    expect(card.pid).toBe('CARD-1')
    expect(asset.pid).toBe('ASSET-1')
  })

  it('increments public ids from existing records for the same prefix', async () => {
    const service = createService()

    const first = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'First card' },
    })
    const second = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Second card' },
    })

    expect(first.pid).toBe('CARD-1')
    expect(second.pid).toBe('CARD-2')
  })

  it('filters records by schema, tags, assignee, asset, relation, text, and limit', async () => {
    const service = createService()
    const asset = await service.create({
      schema: 'AssetBody',
      tags: ['status:todo', 'asset:image'],
      body: { title: 'Dragon portrait' },
    })
    const card = await service.create({
      schema: 'CardBody',
      assignee: 'member-1',
      tags: ['status:wip', 'priority:urgent-important'],
      assets: [asset.id],
      relations: [{ constraint: 'relatedTo', target: asset.id }],
      body: { title: 'Paint dragon portrait', description: 'Boss battle UI' },
    })
    await service.create({
      schema: 'CardBody',
      assignee: 'member-2',
      tags: ['status:todo'],
      body: { title: 'Write tutorial copy' },
    })

    await expect(service.list({ schema: 'AssetBody' })).resolves.toEqual([asset])
    await expect(service.list({ assignee: 'member-1' })).resolves.toEqual([card])
    await expect(service.list({ assetId: asset.id })).resolves.toEqual([card])
    await expect(
      service.list({ relationTarget: asset.id })
    ).resolves.toEqual([card])
    await expect(
      service.list({ tags: ['status:wip', 'priority:urgent-important'] })
    ).resolves.toEqual([card])
    await expect(service.list({ q: 'boss battle' })).resolves.toEqual([card])
    await expect(service.list({ q: '   ' })).resolves.toHaveLength(3)
    await expect(service.list({ id: card.id })).resolves.toEqual([card])
    await expect(service.list({ pid: card.pid })).resolves.toEqual([card])
    await expect(
      service.list({ tags: ['status:wip', 'status:todo'], tagMatch: 'any' })
    ).resolves.toHaveLength(3)
    await expect(service.list({ limit: 1 })).resolves.toHaveLength(1)
  })

  it('updates existing records and returns null for missing records', async () => {
    const service = createService()
    const record = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Update me' },
    })

    await expect(
      service.update(record.id, {
        targetId: record.id,
        tags: ['status:wip'],
        body: { description: 'Updated description' },
      })
    ).resolves.toMatchObject({
      id: record.id,
      tags: ['status:wip'],
      body: {
        title: 'Update me',
        description: 'Updated description',
      },
    })
    await expect(
      service.update('missing', { targetId: 'missing', tags: ['status:wip'] })
    ).resolves.toBeNull()
    await expect(service.delete('missing')).resolves.toBeNull()
  })

  it('archives records and hides them from current board lists by default', async () => {
    const service = createService()
    const record = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Archive me' },
    })

    const archived = await service.delete(record.id)

    expect(archived?.tags).toContain('status:archived')
    await expect(service.findById(record.id)).resolves.toBeNull()
    await expect(service.list({})).resolves.toEqual([])
    await expect(service.list({ includeArchived: true })).resolves.toEqual([
      archived,
    ])
  })

  it('rejects unsupported schemas, pid prefixes, tags, and relation constraints', async () => {
    const service = createService()

    await expect(
      service.create({
        schema: 'UnknownBody',
        tags: ['status:todo'],
        body: { title: 'Invalid schema' },
      })
    ).rejects.toThrow(RecordValidationError)

    await expect(
      service.create({
        schema: 'CardBody',
        pidPrefix: 'BUG',
        tags: ['status:todo'],
        body: { title: 'Invalid prefix' },
      })
    ).rejects.toThrow('Unsupported pid prefix: BUG')

    await expect(
      service.create({
        schema: 'CardBody',
        tags: ['status:not-configured'],
        body: { title: 'Invalid tag' },
      })
    ).rejects.toThrow('Unsupported tag: status:not-configured')

    await expect(
      service.create({
        schema: 'CardBody',
        tags: ['status:todo'],
        relations: [{ constraint: 'invalidRelation', target: 'target-1' }],
        body: { title: 'Invalid relation' },
      })
    ).rejects.toThrow('Unsupported relation constraint: invalidRelation')
  })

  it('falls back to the first configured prefix when schema has no preferred prefix', async () => {
    const config = {
      ...DEFAULT_BOARD_CONFIG,
      records: {
        schemas: [...DEFAULT_BOARD_CONFIG.records.schemas, 'CustomBody'],
      },
    } satisfies BoardConfig
    const service = new RecordService(new MemoryRecordRepository(), config)

    const record = await service.create({
      schema: 'CustomBody',
      tags: ['status:todo'],
      body: { title: 'Custom record' },
    })

    expect(record.pid).toBe('CARD-1')
  })
})
