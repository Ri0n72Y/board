import { describe, expect, it } from 'vitest'
import { Redis } from 'ioredis'
import type { BoardConfig } from '@labour-board/shared'
import { createRedisConfigStore } from './redisConfigStore.js'

const REDIS_URL = process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:6379'

async function canConnect(): Promise<boolean> {
  const probe = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 800,
  })
  try {
    await probe.ping()
    return true
  } catch {
    return false
  } finally {
    probe.disconnect()
  }
}

const redisAvailable = await canConnect()

function makeConfig(): BoardConfig {
  return {
    records: { schemas: ['CardBody', 'AssetBody'] },
    pid: {
      prefixes: ['CARD', 'ASSET'],
      schemaPrefixes: { CardBody: 'CARD', AssetBody: 'ASSET' },
      nextNumber: 1,
      latest: {},
    },
    tags: {
      namespaces: [],
      status: { required: [], custom: [] },
      priority: { defaults: [], custom: [] },
      asset: { defaults: [], custom: [] },
    },
    snapshot: { excludeTags: ['lifecycle:archived'] },
  } as unknown as BoardConfig
}

describe.skipIf(!redisAvailable)('redisConfigStore', () => {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 })
  const store = createRedisConfigStore(redis)

  it('saveConfig/loadConfig roundtrip', async () => {
    await redis.flushdb()
    const config = makeConfig()
    await store.saveConfig(config)
    const loaded = await store.loadConfig()
    expect(loaded).toEqual(config)
  })

  it('loadConfig returns null when absent', async () => {
    await redis.flushdb()
    expect(await store.loadConfig()).toBeNull()
  })

  it('drawNextNumber increments atomically per prefix', async () => {
    await redis.flushdb()
    const results = await Promise.all(
      Array.from({ length: 10 }, () => store.drawNextNumber('CARD'))
    )
    expect([...results].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 10 }, (_, i) => i + 1)
    )
  })

  it('drawNextNumber is independent per prefix', async () => {
    await redis.flushdb()
    await store.drawNextNumber('CARD')
    await store.drawNextNumber('CARD')
    await store.drawNextNumber('ASSET')
    expect(await store.drawNextNumber('CARD')).toBe(3)
    expect(await store.drawNextNumber('ASSET')).toBe(2)
  })

  it('saveLatestNumber/readLatestNumber roundtrip', async () => {
    await redis.flushdb()
    expect(await store.readLatestNumber('CARD')).toBeUndefined()
    await store.saveLatestNumber('CARD', 'rec-1', 'CARD-5', 5)
    expect(await store.readLatestNumber('CARD')).toBe(5)
  })

  it('reconcileCounter seeds the counter to a minimum', async () => {
    await redis.flushdb()
    await store.reconcileCounter('CARD', 7)
    expect(await store.drawNextNumber('CARD')).toBe(8)
  })

  it('reconcileCounter does not lower an already-higher counter', async () => {
    await redis.flushdb()
    await store.drawNextNumber('CARD') // 1
    await store.reconcileCounter('CARD', 100)
    expect(await store.drawNextNumber('CARD')).toBe(101)
  })

  it('exportYaml strips pid runtime state', () => {
    const config = makeConfig()
    config.pid.latest = {
      CARD: { recordId: 'rec-1', pid: 'CARD-42', number: 42 },
    }
    config.pid.nextNumber = 43
    const yaml = store.exportYaml(config)
    expect(yaml).not.toContain('nextNumber')
    expect(yaml).not.toContain('latest')
    expect(yaml).toContain('prefixes')
    expect(yaml).toContain('CARD')
  })

  it('importYaml merges static config while preserving live pid state', async () => {
    await redis.flushdb()
    const config = makeConfig()
    config.pid.latest = {
      CARD: { recordId: 'rec-1', pid: 'CARD-9', number: 9 },
    }
    config.pid.nextNumber = 10

    const yaml = `
pid:
  prefixes:
    - CARD
    - ASSET
  schemaPrefixes:
    CardBody: CARD
  nextNumber: 99
  latest:
    CARD:
      recordId: stale
      pid: CARD-1
      number: 1
tags:
  namespaces: []
  status:
    required: []
    custom: []
  priority:
    defaults: []
    custom: []
  asset:
    defaults: []
    custom: []
`
    const imported = await store.importYaml(yaml, config)
    expect(imported.pid.nextNumber).toBe(10)
    expect(imported.pid.latest?.CARD?.number).toBe(9)
    expect(imported.pid.latest?.CARD?.recordId).toBe('rec-1')
    expect(imported.pid.prefixes).toEqual(['CARD', 'ASSET'])
  })

  it('importYaml rejects invalid yaml', async () => {
    await expect(store.importYaml('not: [valid', null)).rejects.toThrow()
  })
})
