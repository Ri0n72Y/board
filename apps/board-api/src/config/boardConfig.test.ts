import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DEFAULT_BOARD_CONFIG } from '@labour-board/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { BoardConfigError, loadBoardConfig } from './boardConfig.js'
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
    expect(config.pid).toEqual({ prefixes: ['CARD', 'ASSET'], nextNumber: 7 })
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

  it('rejects structurally incomplete config', async () => {
    const configPath = await writeTempConfig('records:\n  schemas: []\n')

    await expect(
      loadBoardConfig({
        ...BASE_ENV,
        boardConfigPath: configPath,
      })
    ).rejects.toThrow('pid.prefixes must be an array')
  })
})

async function writeTempConfig(source: string): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), 'labour-board-config-'))
  const configPath = join(tempDir, 'board.yaml')
  await writeFile(configPath, source, 'utf8')
  return configPath
}
