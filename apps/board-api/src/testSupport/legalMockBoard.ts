import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parse } from 'yaml'
import type { BoardConfig } from '@labour-board/shared'
import type {
  StoredRecordDoc,
  MemoryRecordRepository,
} from '../repositories/recordRepository.js'

const workspaceRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..'
)

export async function loadLegalMockRecords(): Promise<StoredRecordDoc[]> {
  const content = await readFile(
    join(workspaceRoot, 'test-data', 'mocked_records.json'),
    'utf8'
  )
  return JSON.parse(content) as StoredRecordDoc[]
}

export async function loadLegalMockBoardConfig(): Promise<BoardConfig> {
  const content = await readFile(
    join(workspaceRoot, 'test-data', 'mocked_board.yaml'),
    'utf8'
  )
  return parse(content) as BoardConfig
}

export async function seedLegalMockBoard(
  repository: MemoryRecordRepository
): Promise<StoredRecordDoc[]> {
  const records = await loadLegalMockRecords()
  for (const record of records) {
    await repository.create(record)
  }
  return records
}
