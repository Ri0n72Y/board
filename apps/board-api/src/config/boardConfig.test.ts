import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DEFAULT_BOARD_CONFIG } from '@labour-board/shared'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BoardConfigError,
  loadBoardConfig,
  loadBoardConfigState,
} from './boardConfig.js'
import type { ApiEnv } from './env.js'

const BASE_ENV: ApiEnv = {
  boardConfigOptional: false,
  mongodbDb: 'labour_board',
  port: 8787,
}

const VALID_CONFIG = `
records:
  schemas:
    - CardBody
    - AssetBody
pid:
  prefixes:
    - CARD
    - ASSET
  nextNumber: 7
tags:
  namespaces:
    - id: status
  status:
    required:
      - id: status:todo
    custom: []
  priority:
    defaults: []
    custom: []
  asset:
    defaults: []
    custom: []
  transaction:
    defaults: []
    custom: []
  custom: []
relations:
  constraints:
    - relatedTo
snapshot:
  excludeTags:
    - status:archived
`

let tempDir: string | undefined

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = undefined
  }
})

describe('loadBoardConfig', () => {
  it('loads a valid yaml config from an explicit path', async () => {
    const configPath = await writeTempConfig(VALID_CONFIG)

    const config = await loadBoardConfig({
      ...BASE_ENV,
      boardConfigPath: configPath,
    })

    expect(config.records.schemas).toEqual(['CardBody', 'AssetBody'])
    expect(config.pid).toMatchObject({
      prefixes: ['CARD', 'ASSET'],
      schemaPrefixes: DEFAULT_BOARD_CONFIG.pid.schemaPrefixes,
      nextNumber: 7,
    })
    expect(config.snapshot.excludeTags).toEqual(['status:archived'])
  })

  it('throws a clear error when an explicit config path is missing', async () => {
    await expect(
      loadBoardConfig({
        ...BASE_ENV,
        boardConfigPath: 'missing-board.yaml',
      })
    ).rejects.toThrow(BoardConfigError)

    await expect(
      loadBoardConfig({
        ...BASE_ENV,
        boardConfigPath: 'missing-board.yaml',
      })
    ).rejects.toThrow('Board config file not found at missing-board.yaml')
  })

  it('does not silently fall back for an explicit missing path', async () => {
    await expect(
      loadBoardConfig({
        ...BASE_ENV,
        boardConfigOptional: true,
        boardConfigPath: 'missing-board.yaml',
      })
    ).rejects.toThrow('Board config file not found at missing-board.yaml')
  })

  it('falls back to the default config only when optional and using the default path', async () => {
    const config = await loadBoardConfig(
      {
        ...BASE_ENV,
        boardConfigOptional: true,
      },
      {
        defaultConfigPath: 'missing-default-board.yaml',
      }
    )

    expect(config).toBe(DEFAULT_BOARD_CONFIG)
  })

  it('rejects malformed yaml', async () => {
    const configPath = await writeTempConfig('records: [')

    await expect(
      loadBoardConfig({
        ...BASE_ENV,
        boardConfigPath: configPath,
      })
    ).rejects.toThrow('Invalid board config YAML')
  })

  it('uses defaults for structurally incomplete config', async () => {
    const configPath = await writeTempConfig('records:\n  schemas: []\n')

    const config = await loadBoardConfig({
      ...BASE_ENV,
      boardConfigPath: configPath,
    })

    expect(config.records.schemas).toEqual(DEFAULT_BOARD_CONFIG.records.schemas)
    expect(config.pid.prefixes).toEqual(DEFAULT_BOARD_CONFIG.pid.prefixes)
  })

  it('reports warnings while preserving malformed tag ids', async () => {
    const configPath = await writeTempConfig(`
records:
  schemas: []
pid:
  prefixes: []
  nextNumber: -1
tags:
  namespaces: []
  status:
    required:
      - id: status todo
    custom: []
  priority:
    defaults: []
    custom: []
  asset:
    defaults: []
    custom: []
  transaction:
    defaults: []
    custom: []
  custom: []
relations:
  constraints: []
snapshot:
  excludeTags:
    - status:archived
    - missing:tag
`)

    const state = await loadBoardConfigState({
      ...BASE_ENV,
      boardConfigPath: configPath,
    })

    expect(state.config.pid.prefixes).toEqual(DEFAULT_BOARD_CONFIG.pid.prefixes)
    expect(state.config.pid.nextNumber).toBe(DEFAULT_BOARD_CONFIG.pid.nextNumber)
    expect(state.needsPidReconciliation).toBe(true)
    expect(state.config.tags.status.required).toEqual([{ id: 'status todo' }])
    expect(state.warnings).toContain(
      `Invalid tag id format at ${configPath}: status todo; keeping original value.`
    )
  })
})

async function writeTempConfig(source: string): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), 'labour-board-config-'))
  const configPath = join(tempDir, 'board.yaml')
  await writeFile(configPath, source, 'utf8')
  return configPath
}
