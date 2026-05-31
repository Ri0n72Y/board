import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { MemoryRecordRepository } from '../../repositories/recordRepository.js'
import { MemorySnapshotHeadRepository } from '../../repositories/snapshotHeadRepository.js'
import { RecordService, RecordValidationError } from '../recordService.js'
import { createRecordService } from './recordTestUtils.js'

describe('RecordService CRUD', () => {
  it('creates, lists, and reads records', async () => {
    const service = createRecordService()

    const envelope = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'My card' },
    })

    expect(envelope).toHaveProperty('createdBy')
    expect(envelope).toHaveProperty('createdAt')
    expect(envelope.body.pid).toBe('CARD-1')
    expect(envelope.body.schema).toBe('CardBody')
    expect(envelope.body.body.title).toBe('My card')

    const found = await service.findById(envelope.body.id)
    expect(found).not.toBeNull()
    expect(found!.body.id).toBe(envelope.body.id)

    const list = await service.list({})
    expect(list).toHaveLength(1)
    expect(list[0].body.id).toBe(envelope.body.id)
  })

  it('returns null when finding a missing record', async () => {
    const service = createRecordService()
    await expect(service.findById('missing')).resolves.toBeNull()
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
    const repo = new MemoryRecordRepository()
    const service = new RecordService(repo, new MemorySnapshotHeadRepository(repo), config)

    const envelope = await service.create({
      schema: 'CustomBody',
      tags: ['status:todo'],
      body: { title: 'Custom record' },
    })

    expect(envelope.body.pid).toBe('CARD-1')
  })
})
