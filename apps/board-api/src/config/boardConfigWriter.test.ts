import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parse } from 'yaml'
import { DEFAULT_BOARD_CONFIG } from '@labour-board/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { createBoardConfigPidWriter } from './boardConfig.js'

let tempDir: string | undefined

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = undefined
  }
})

describe('createBoardConfigPidWriter', () => {
  it('updates only the pid section on manual flush', async () => {
    const configPath = await writeTempConfig(`
records:
  schemas:
    - CardBody
pid:
  prefixes:
    - CARD
  schemaPrefixes:
    CardBody: CARD
  nextNumber: 1
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
  transaction:
    defaults: []
    custom: []
  custom: []
relations:
  constraints: []
snapshot:
  excludeTags:
    - status:archived
`)
    const writer = createBoardConfigPidWriter(configPath, 60_000)
    const config = structuredClone(DEFAULT_BOARD_CONFIG)
    config.pid.latest = {
      CARD: {
        recordId: 'record-1',
        pid: 'CARD-9',
        number: 9,
      },
    }

    writer.schedulePidWrite(config)
    await writer.flush()

    const written = parse(await readFile(configPath, 'utf8')) as {
      records: { schemas: string[] }
      pid: typeof config.pid
      snapshot: { excludeTags: string[] }
    }
    expect(written.records.schemas).toEqual(['CardBody'])
    expect(written.snapshot.excludeTags).toEqual(['status:archived'])
    expect(written.pid.latest?.CARD).toEqual({
      recordId: 'record-1',
      pid: 'CARD-9',
      number: 9,
    })
  })

  it('does nothing when flushed without pending pid state', async () => {
    const configPath = await writeTempConfig('records:\n  schemas: []\n')
    const writer = createBoardConfigPidWriter(configPath, 60_000)

    await writer.flush()

    await expect(readFile(configPath, 'utf8')).resolves.toBe(
      'records:\n  schemas: []\n'
    )
  })
})

async function writeTempConfig(source: string): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), 'labour-board-writer-'))
  const configPath = join(tempDir, 'board.yaml')
  await writeFile(configPath, source, 'utf8')
  return configPath
}
