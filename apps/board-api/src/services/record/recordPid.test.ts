import { DEFAULT_BOARD_CONFIG } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { MemoryRecordRepository } from '../../repositories/recordRepository.js'
import { MemorySnapshotHeadRepository } from '../../repositories/snapshotHeadRepository.js'
import { RecordService } from '../recordService.js'
import {
  cloneDefaultBoardConfig,
  createRecordService,
  createWriter,
} from './recordTestUtils.js'

describe('RecordService pid allocation', () => {
  it('creates card and asset records with config-driven public ids', async () => {
    const service = createRecordService()

    const card = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Implement inventory board' },
    })
    const asset = await service.create({
      schema: 'AssetBody',
      tags: ['status:todo', 'asset:image'],
      body: { title: 'Inventory icon', uri: 'asset://inventory-icon.png' },
    })

    expect(card.body.pid).toBe('CARD-1')
    expect(asset.body.pid).toBe('ASSET-1')
  })

  it('increments public ids from existing records for the same prefix', async () => {
    const service = createRecordService()

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

    expect(first.body.pid).toBe('CARD-1')
    expect(second.body.pid).toBe('CARD-2')
  })

  it('serializes concurrent pid draws and persists pid cache state', async () => {
    const config = cloneDefaultBoardConfig()
    const writer = createWriter()
    const repository = new MemoryRecordRepository()
    const service = new RecordService(
      repository,
      new MemorySnapshotHeadRepository(repository),
      config,
      writer
    )

    const records = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        service.create({
          schema: 'CardBody',
          tags: ['status:todo'],
          body: { title: `Concurrent ${index}` },
        })
      )
    )

    expect(records.map((record) => record.body.pid).sort()).toEqual([
      'CARD-1',
      'CARD-2',
      'CARD-3',
      'CARD-4',
      'CARD-5',
    ])
    expect(config.pid.latest?.CARD?.pid).toBe('CARD-5')
    expect(writer.schedulePidWrite).toHaveBeenCalledTimes(5)
  })

  it('uses a heavy record scan when cached pid state conflicts', async () => {
    const repository = new MemoryRecordRepository()
    await repository.create({
      id: 'existing-record',
      pid: 'CARD-1',
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Existing' },
      createdBy: 'local',
      createdAt: '2020-01-01T00:00:00.000Z',
    })
    const service = new RecordService(
      repository,
      new MemorySnapshotHeadRepository(repository),
      cloneDefaultBoardConfig()
    )

    const record = await service.create({
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'New record' },
    })

    expect(record.body.pid).toBe('CARD-2')
  })

  it('reconciles pid cache and nextNumber from existing records', async () => {
    const repository = new MemoryRecordRepository()
    const config = cloneDefaultBoardConfig()
    const writer = createWriter()
    await repository.create({
      id: 'record-1',
      pid: 'CARD-7',
      schema: 'CardBody',
      tags: ['status:todo'],
      body: { title: 'Existing card max' },
      createdBy: 'local',
      createdAt: '2020-01-01T00:00:00.000Z',
    })
    await repository.create({
      id: 'record-2',
      pid: 'ASSET-3',
      schema: 'AssetBody',
      tags: ['status:todo'],
      body: { title: 'Existing asset max' },
      createdBy: 'local',
      createdAt: '2020-01-01T00:00:00.000Z',
    })
    const service = new RecordService(
      repository,
      new MemorySnapshotHeadRepository(repository),
      config,
      writer
    )

    await service.reconcilePidState()

    expect(config.pid.nextNumber).toBe(8)
    expect(config.pid.latest?.CARD?.number).toBe(7)
    expect(config.pid.latest?.ASSET?.number).toBe(3)
    expect(writer.schedulePidWrite).toHaveBeenCalledOnce()
  })

  it('keeps nextNumber at least 1 when no records exist', async () => {
    const config = {
      ...cloneDefaultBoardConfig(),
      pid: {
        ...structuredClone(DEFAULT_BOARD_CONFIG.pid),
        nextNumber: 0,
      },
    }
    const writer = createWriter()
    const repository = new MemoryRecordRepository()
    const service = new RecordService(
      repository,
      new MemorySnapshotHeadRepository(repository),
      config,
      writer
    )

    await service.reconcilePidState()

    expect(config.pid.nextNumber).toBe(1)
    expect(writer.schedulePidWrite).toHaveBeenCalledOnce()
  })
})
