/**
 * importTestData.ts
 *
 * Imports mocked_board.yaml and mocked_records.json into a local MongoDB.
 *
 * Reads MONGODB_URI and MONGODB_DB from:
 *   1. Shell environment (highest priority)
 *   2. apps/board-api/.env (loaded via dotenv)
 *
 * Safety:
 *  - Refuses to run in production (NODE_ENV === 'production').
 *  - Requires MONGODB_URI to be set (from shell or .env).
 *  - Refuses to overwrite non-empty collections unless --reset is passed.
 *  - Prints target database/collection info before inserting.
 *
 * Usage:
 *   pnpm --filter @labour-board/api import:test-data -- --reset
 *   pnpm --filter @labour-board/api import:test-data -- --help
 */

import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseDocument } from 'yaml'
import { MongoClient } from 'mongodb'

const TEST_DATA_DIR = resolve(import.meta.dirname ?? '.', '../../../../test-data')
const BOARD_YAML = resolve(TEST_DATA_DIR, 'mocked_board.yaml')
const RECORDS_JSON = resolve(TEST_DATA_DIR, 'mocked_records.json')

function printUsage() {
  console.log(
    [
      'Usage: pnpm --filter @labour-board/api import:test-data -- [options]',
      '',
      'Options:',
      '  --reset    Clear existing records in the target collection before import.',
      '  --help     Show this help message.',
      '',
      'Environment:',
      '  MONGODB_URI   MongoDB connection string.',
      '  MONGODB_DB    Database name (default: labour_board).',
      '',
      '  These are automatically loaded from apps/board-api/.env if present.',
      '  Shell environment variables take priority over .env values.',
      '',
      'Example:',
      '  # With .env configured:',
      '  pnpm --filter @labour-board/api import:test-data -- --reset',
      '  # Or override via command line:',
      '  MONGODB_URI=mongodb://localhost:27017 pnpm --filter @labour-board/api import:test-data -- --reset',
    ].join('\n'),
  )
}

async function main() {
  const args = process.argv.slice(2)
  const reset = args.includes('--reset')
  const help = args.includes('--help')

  if (help) {
    printUsage()
    process.exit(0)
  }

  // ─── Production guard ───
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Refusing to run in production (NODE_ENV=production).')
    process.exit(1)
  }

  // ─── Mongo URI check ───
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    console.error('ERROR: MONGODB_URI must be set.')
    console.error('Configure it in apps/board-api/.env:')
    console.error('  MONGODB_URI=mongodb://localhost:27017')
    console.error('  MONGODB_DB=labourboard_dev')
    console.error('Or pass it on the command line:')
    console.error('  MONGODB_URI=mongodb://localhost:27017 pnpm --filter @labour-board/api import:test-data -- --reset')
    process.exit(1)
  }

  const dbName = process.env.MONGODB_DB ?? 'labour_board'

  console.log('─── Test Data Import ───')
  console.log(`Mongo URI:  ${mongoUri.replace(/\/\/[^@]+@/, '//<credentials>@')}`)
  console.log(`Database:   ${dbName}`)
  console.log(`Collection: records`)
  console.log(`Reset:      ${reset}`)
  console.log('')

  // ─── Read test data ───
  let rawRecords: unknown
  try {
    const boardYamlText = await readFile(BOARD_YAML, 'utf8')
    const boardDoc = parseDocument(boardYamlText)
    if (boardDoc.errors.length > 0) {
      console.error('ERROR: Invalid board YAML:')
      for (const e of boardDoc.errors) console.error(`  ${e.message}`)
      process.exit(1)
    }
    console.log(`✓ Read board config from ${BOARD_YAML}`)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`ERROR: Board config not found at ${BOARD_YAML}`)
    } else {
      console.error(`ERROR: Failed to read board config: ${(err as Error).message}`)
    }
    process.exit(1)
  }

  try {
    const recordsText = await readFile(RECORDS_JSON, 'utf8')
    rawRecords = JSON.parse(recordsText)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`ERROR: Records file not found at ${RECORDS_JSON}`)
    } else {
      console.error(`ERROR: Failed to parse records JSON: ${(err as Error).message}`)
    }
    process.exit(1)
  }

  if (!Array.isArray(rawRecords)) {
    console.error('ERROR: mocked_records.json must contain a JSON array.')
    process.exit(1)
  }

  const records = rawRecords as Record<string, unknown>[]

  // ─── Validate records ───
  let validCount = 0
  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    if (!record.id || typeof record.id !== 'string') {
      console.error(`ERROR: Record at index ${i} is missing a valid 'id'.`)
      process.exit(1)
    }
    if (!record.pid || typeof record.pid !== 'string') {
      console.error(`ERROR: Record ${record.id} is missing a valid 'pid'.`)
      process.exit(1)
    }
    validCount++
  }

  console.log(`✓ Found ${validCount} records to import`)
  console.log('')

  // ─── Connect to Mongo ───
  let client: MongoClient
  try {
    client = new MongoClient(mongoUri)
    await client.connect()
    console.log('✓ Connected to MongoDB')
  } catch (err) {
    console.error(`ERROR: Failed to connect to MongoDB: ${(err as Error).message}`)
    process.exit(1)
  }

  const db = client.db(dbName)
  const collection = db.collection('records')
  const snapshotsCollection = db.collection('snapshots')

  // ─── Check existing data ───
  const existingCount = await collection.countDocuments()
  console.log(`  Existing records in collection: ${existingCount}`)

  if (existingCount > 0 && !reset) {
    console.error('')
    console.error('ERROR: Target collection is not empty.')
    console.error('Use --reset to clear existing records before import.')
    console.error('This prevents accidental data overwrite.')
    await client.close()
    process.exit(1)
  }

  // ─── Reset if requested ───
  if (reset && existingCount > 0) {
    console.log(`  Clearing ${existingCount} existing records...`)
    await collection.deleteMany({})
    console.log('  ✓ Collection cleared')
  }

  if (reset) {
    const snapshotCount = await snapshotsCollection.countDocuments()
    if (snapshotCount > 0) {
      console.log(`  Clearing ${snapshotCount} existing snapshot heads...`)
      await snapshotsCollection.deleteMany({})
      console.log('  Snapshot collection cleared')
    }
  }

  // ─── Create index on id for record query ───
  try {
    await collection.createIndex({ id: 1 }, { unique: true })
    console.log('  ✓ Index on id created')
  } catch {
    console.log('  (Index on id already exists)')
  }

  // ─── Import records ───
  try {
    const result = await collection.insertMany(records)
    console.log(`  ✓ Inserted ${result.insertedCount} records`)
  } catch (err) {
    console.error(`ERROR: Failed to insert records: ${(err as Error).message}`)
    await client.close()
    process.exit(1)
  }

  // ─── Verify ───
  const finalCount = await collection.countDocuments()
  console.log(`  Final record count: ${finalCount}`)
  console.log('')
  console.log('─── Import Complete ───')
  console.log('')
  console.log('Next steps:')
  console.log(`  1. Start API: pnpm --filter @labour-board/api dev`)
  console.log(`  2. Start Web: pnpm --filter @labour-board/web dev -- --host 127.0.0.1 --port 5173 --strictPort`)
  console.log(`  3. Verify: curl http://localhost:8787/api/v0/board/current`)
  console.log('')

  await client.close()
  process.exit(0)
}

void main()
