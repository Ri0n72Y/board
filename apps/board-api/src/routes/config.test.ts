import { Hono } from 'hono'
import { DEFAULT_BOARD_CONFIG, type BoardConfig } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { ConfigService } from '../services/configService.js'
import { createConfigRoute } from './config.js'
import { createRedisConfigStore } from '../config/redisConfigStore.js'
import { stringify } from 'yaml'
import type { RedisConfigStore } from '../config/redisConfigStore.js'

// Redis-free store for route tests: importYaml is pure (parse + normalize),
// exportYaml is pure (stringify). No Redis connection is made.
function createTestConfigStore(): RedisConfigStore {
  const pure = createRedisConfigStore(null as never)
  return {
    loadConfig: async () => null,
    saveConfig: async () => {},
    drawNextNumber: async () => 1,
    readLatestNumber: async () => undefined,
    saveLatestNumber: async () => {},
    reconcileCounter: async () => {},
    exportYaml: (config) => pure.exportYaml(config),
    importYaml: (text, current) => pure.importYaml(text, current),
  }
}

function makeApp(store?: RedisConfigStore) {
  const app = new Hono()
  app.route(
    '/api/v0/config',
    createConfigRoute(new ConfigService(DEFAULT_BOARD_CONFIG, {}, store))
  )
  return app
}

describe('createConfigRoute', () => {
  it('returns the current board config', async () => {
    const app = makeApp()
    const response = await app.request('/api/v0/config')
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload).toEqual({ ok: true, data: DEFAULT_BOARD_CONFIG })
  })

  it('POST / updates config while preserving pid runtime state', async () => {
    const store = createTestConfigStore()
    const app = makeApp(store)
    const body = {
      tags: {
        ...DEFAULT_BOARD_CONFIG.tags,
        namespaces: [{ id: 'epic', displayName: 'Epic', locked: false }],
      },
      pid: {
        nextNumber: 999,
        latest: { CARD: { recordId: 'x', pid: 'CARD-99', number: 99 } },
      },
    }
    const response = await app.request('/api/v0/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data.pid.nextNumber).toBe(DEFAULT_BOARD_CONFIG.pid.nextNumber)
    expect(payload.data.pid.latest).toBe(DEFAULT_BOARD_CONFIG.pid.latest)
    expect(payload.data.tags.namespaces[0].id).toBe('epic')
  })

  it('GET /yaml exports static config without pid runtime state', async () => {
    const store = createTestConfigStore()
    const app = makeApp(store)
    const response = await app.request('/api/v0/config/yaml')
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('CardBody')
    expect(text).not.toContain('nextNumber')
    expect(text).not.toContain('latest')
  })

  it('POST /yaml imports config and rejects empty body', async () => {
    const store = createTestConfigStore()
    const app = makeApp(store)
    const yaml = stringify({
      records: { schemas: ['CardBody'] },
      pid: { prefixes: ['CARD'], schemaPrefixes: { CardBody: 'CARD' } },
      tags: DEFAULT_BOARD_CONFIG.tags,
    })
    const response = await app.request('/api/v0/config/yaml', {
      method: 'POST',
      headers: { 'content-type': 'text/yaml' },
      body: yaml,
    })
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)

    const empty = await app.request('/api/v0/config/yaml', {
      method: 'POST',
      headers: { 'content-type': 'text/yaml' },
      body: '',
    })
    const emptyPayload = await empty.json()
    expect(empty.status).toBe(400)
    expect(emptyPayload.error.code).toBe('EMPTY_YAML')
  })

  it('POST /yaml normalizes structurally loose yaml with fallbacks', async () => {
    const store = createTestConfigStore()
    const app = makeApp(store)
    // pid.prefixes as a scalar string is not a valid shape; normalize falls
    // back to the default prefixes instead of crashing or persisting garbage.
    const bad = await app.request('/api/v0/config/yaml', {
      method: 'POST',
      headers: { 'content-type': 'text/yaml' },
      body: 'pid:\n  prefixes: just-a-string\n',
    })
    const payload = await bad.json()
    expect(bad.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(Array.isArray(payload.data.pid.prefixes)).toBe(true)
    expect(payload.data.pid.prefixes).toContain('CARD')
  })

  it('POST /yaml rejects non-mapping root', async () => {
    const store = createTestConfigStore()
    const app = makeApp(store)
    const bad = await app.request('/api/v0/config/yaml', {
      method: 'POST',
      headers: { 'content-type': 'text/yaml' },
      body: '- just\n- a\n- list\n',
    })
    const payload = await bad.json()
    expect(bad.status).toBe(400)
    expect(payload.error.code).toBe('INVALID_YAML')
  })
})
