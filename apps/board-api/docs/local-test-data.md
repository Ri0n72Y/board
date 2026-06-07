# Local Test Data Import

## Purpose

Import pre-built test data (`test-data/mocked_board.yaml` and `test-data/mocked_records.json`) into a local MongoDB instance so that `board-web` displays a non-empty board for manual UI smoke testing.

## Data Source

- `test-data/mocked_board.yaml` – board configuration (tag schemas, pid prefixes, relation constraints)
- `test-data/mocked_records.json` – 33 test records with valid UUIDs, PIDs, tags, and relations

## Safety Constraints

- **Production guard**: The script refuses to run if `NODE_ENV=production`.
- **MongoDB only**: The script requires `MONGODB_URI` to be set (from `.env` or shell).
- **No auto-import**: The import script is never invoked during `dev` startup. You must run it manually.
- **Overwrite protection**: If the target `records` collection is non-empty, the script refuses to import unless `--reset` is passed.
- **No production data mutation**: Always point `MONGODB_URI` at a local/dev database.

## Prerequisites

- A running local MongoDB instance (e.g., `mongodb://localhost:27017`)
- Node.js with project dependencies installed (`pnpm install`)

## Quick Start

### 1. Configure .env

```bash
cp apps/board-api/.env.example apps/board-api/.env
```

Verify `apps/board-api/.env` contains the correct MongoDB settings:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=labourboard_dev
```

Both the import script and the API dev server read from this `.env` file.
Shell environment variables (e.g., `export MONGODB_URI=...`) take priority over `.env` values.

### 2. Import test data

```bash
pnpm --filter @labour-board/api import:test-data -- --reset
```

### 3. Start API

```bash
pnpm --filter @labour-board/api dev
```

The API will log whether it's using MongoDB or Memory mode.
With `.env` configured, it should use MongoDB.

### 4. Start Web UI

```bash
pnpm --filter @labour-board/web dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open `http://127.0.0.1:5173` – the board should show test records.

## Verification

```bash
curl http://localhost:8787/api/v0/board/current
```

The response should contain:
- `data.records.length > 0`
- Each record has `pid`, `body.id` (UUID), `tags` with `status:*` etc.
- Chinese text in record titles and descriptions is readable UTF-8

## Troubleshooting: Data visible in Compass but API returns empty

If you can see records in MongoDB Compass but `GET /api/v0/board/current` returns `data.records = []`, check:

1. **Does `.env` exist?**
   ```bash
   ls apps/board-api/.env
   ```

2. **Does `.env` contain `MONGODB_URI` and `MONGODB_DB`?**
   ```bash
   cat apps/board-api/.env | grep MONGO
   ```

3. **Is the database name correct?**
   Check that `MONGODB_DB` in `.env` matches the database name shown in Compass.

4. **Did you import to the same database?**
   The `import:test-data` script and the API dev server both read from the same `.env`.
   If you previously imported using a shell variable, ensure the database name matches.

5. **Is the API using MongoDB or Memory?**
   When the API starts with a valid `MONGODB_URI`, it uses MongoDB repositories.
   When `MONGODB_URI` is missing, it falls back to Memory (data lost on restart).
   Check API startup logs for Mongo connection messages.

6. **Is the collection named `records`?**
   Both the import script and the API use the `records` collection.

## Reset / Cleanup

```bash
# To remove test data and start fresh:
pnpm --filter @labour-board/api import:test-data -- --reset
```

## Memory Repository Note

The board-api uses `MemoryRecordRepository` when `MONGODB_URI` is not set. Memory repositories cannot persist data across restarts. For local smoke testing with persistent data, always configure `MONGODB_URI` in `.env`.

## Not for Production

This script and test data are designed for local development and testing only. Never run against a production database.
