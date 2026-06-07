# Local Test Data Import

## Purpose

Import pre-built test data (`test-data/mocked_board.yaml` and `test-data/mocked_records.json`) into a local MongoDB instance so that `board-web` displays a non-empty board for manual UI smoke testing.

## Data Source

- `test-data/mocked_board.yaml` – board configuration (tag schemas, pid prefixes, relation constraints)
- `test-data/mocked_records.json` – 33 test records with valid UUIDs, PIDs, tags, and relations

## Safety Constraints

- **Production guard**: The script refuses to run if `NODE_ENV=production`.
- **MongoDB only**: The script requires `MONGODB_URI` to be set. Memory repository is not supported for import.
- **No auto-import**: The import script is never invoked during `dev` startup. You must run it manually.
- **Overwrite protection**: If the target `records` collection is non-empty, the script refuses to import unless `--reset` is passed.
- **No production data mutation**: Always point `MONGODB_URI` at a local/dev database.

## Prerequisites

- A running local MongoDB instance (e.g., `mongodb://localhost:27017`)
- Node.js with project dependencies installed (`pnpm install`)

## Usage

### Basic import (new empty database)

```bash
MONGODB_URI=mongodb://localhost:27017/labourboard_dev pnpm --filter @labour-board/api import:test-data
```

### Import with reset (clear existing records first)

```bash
MONGODB_URI=mongodb://localhost:27017/labourboard_dev pnpm --filter @labour-board/api import:test-data -- --reset
```

### Show help

```bash
pnpm --filter @labour-board/api import:test-data -- --help
```

## Verification

After import, start the API and verify via curl:

```bash
MONGODB_URI=mongodb://localhost:27017/labourboard_dev pnpm --filter @labour-board/api dev
curl http://localhost:8787/api/v0/board/current
```

The response should contain:
- `records.length > 0`
- Each record has `pid`, `body.id` (UUID), `tags` with `status:*` etc.
- Chinese text in record titles and descriptions is readable UTF-8

Then start the web UI:

```bash
pnpm --filter @labour-board/web dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open `http://127.0.0.1:5173` – the board should show test records.

## Reset / Cleanup

```bash
# To remove test data and start fresh:
MONGODB_URI=mongodb://localhost:27017/labourboard_dev pnpm --filter @labour-board/api import:test-data -- --reset
```

## Memory Repository Note

The board-api uses `MemoryRecordRepository` when `MONGODB_URI` is not set. Memory repositories cannot persist data across restarts. For local smoke testing with persistent data, always use a MongoDB connection.

## Not for Production

This script and test data are designed for local development and testing only. Never run against a production database.
