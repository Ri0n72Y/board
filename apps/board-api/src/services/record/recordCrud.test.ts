import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { MemoryRecordRepository } from '../../repositories/recordRepository.js'
import { RecordService, RecordValidationError } from '../recordService.js'
import { createRecordService } from './recordTestUtils.js'

describe('RecordService CRUD and validation', () => {
  it('updates existing records and returns null for missing records', async () => {
    const service = createRecordService()
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
    const service = createRecordService()
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
    const service = createRecordService()

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
      ...structuredClone(DEFAULT_BOARD_CONFIG),
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
