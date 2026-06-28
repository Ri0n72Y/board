import { readFile, writeFile } from 'node:fs/promises'
import { parseDocument, stringify } from 'yaml'
import type { BoardConfig } from '@labour-board/shared'
import { isRecord } from '../utils/object.js'
import {
  BoardConfigError,
  type BoardConfigPidWriter,
} from './boardConfigTypes.js'

export function createBoardConfigPidWriter(
  configPath: string,
  flushDelayMs = 5000
): BoardConfigPidWriter {
  let pendingPid: BoardConfig['pid'] | undefined
  let timer: NodeJS.Timeout | undefined

  async function flush(): Promise<void> {
    if (!pendingPid) {
      return
    }

    const pid = structuredClone(pendingPid)
    pendingPid = undefined
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }

    const source = await readFile(configPath, 'utf8')
    const document = parseDocument(source)
    if (document.errors.length > 0) {
      throw new BoardConfigError(
        `Invalid board config YAML at ${configPath}: ${document.errors
          .map((yamlError) => yamlError.message)
          .join('; ')}`
      )
    }

    const current = document.toJS() as unknown
    const nextConfig = isRecord(current) ? current : {}
    nextConfig.pid = pid
    await writeFile(configPath, stringify(nextConfig), 'utf8')
  }

  return {
    schedulePidWrite(config) {
      pendingPid = structuredClone(config.pid)
      if (timer) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        void flush()
      }, flushDelayMs)
      timer.unref?.()
    },
    flush,
  }
}
