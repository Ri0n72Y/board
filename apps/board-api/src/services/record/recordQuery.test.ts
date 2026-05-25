import { describe, expect, it } from 'vitest'
import { createRecordService } from './recordTestUtils.js'

describe('RecordService queries', () => {
  it('filters records by schema, tags, assignee, asset, relation, text, and limit', async () => {
    const service = createRecordService()
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
    await expect(service.list({ relationTarget: asset.id })).resolves.toEqual([
      card,
    ])
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
})
