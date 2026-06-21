# Backend Baseline

This document records the Phase 1 backend baseline as implemented in the
current checkout.

## Product Boundary

`board-api` stores base records and patch facts, exposes current board
projection reads, supports manual snapshots, and stores manual Agent review
artifacts. It does not run Agents and does not apply AI-generated patches.

Primary board-web read entry:

```http
GET /api/v0/board/current
```

`GET /api/v0/records` remains a base record/fact list and is not the replayed
current board view.

## Current Capabilities

- YAML config read: `GET /api/v0/config`.
- Profile read/write routes exist; board-web Phase 1 does not expose profile management.
- Record create/read/list.
- Patch creation through `POST /api/v0/records/:id/patches`.
- Patch fact read by id or target id.
- Record current head through `GET /api/v0/records/:id/head`.
- Record history through `GET /api/v0/records/:id/history`.
- Current board projection and shared filtering.
- Manual snapshot create/list/detail/export.
- Current board export and Context Pack export.
- Agent Draft Review Queue.
- Formal reviewed-draft handoff.
- Manual Agent Response artifacts.

## Mongo Collection Boundary

- `records` stores base records and patch facts.
- `snapshots` stores snapshot-head cache documents and saved manual snapshots.
- `profiles` stores profile documents.

Config comes from YAML, not a Mongo config collection.

## Patch / Head Boundary

Patch submit is the canonical record mutation path:

```http
GET  /api/v0/records/:id/head
POST /api/v0/records/:id/patches
```

Board-web uses `currentVersion`. The backend requires this field and does not
accept legacy version aliases. `GET /api/v0/records/:id/head` is the only
external current-head entrypoint; `/api/v0/snapshot-head` is not exposed as an
HTTP route.

## Snapshot Boundary

Manual snapshots are saved projection checkpoints:

- `POST /api/v0/snapshots`
- `GET /api/v0/snapshots`
- `GET /api/v0/snapshots/:id`
- `GET /api/v0/snapshots/:id/export`

Snapshot export uses the stored snapshot projection. It does not read back the
current board.

Snapshot restore/diff/apply is not implemented.

## Agent Boundary

Phase 1 Agent functionality is non-executing:

- No AI provider call.
- No use of `AGENT_API_KEY` in board-web.
- Agent Draft stores static `contextMarkdown`.
- Handoff is generated Markdown only.
- Manual Agent Response is a human-pasted artifact.
- Agent workflow does not create records, patches, snapshots, or board mutations.

The following routes do not exist:

```text
POST /api/v0/agent/run
POST /api/v0/agent/apply
POST /api/v0/agent/execute
POST /api/v0/agent/responses/manual
PATCH /api/v0/records/:id
DELETE /api/v0/records/:id
POST /api/v0/patches
GET /api/v0/snapshot-head
PUT *
```

## Known Backend Residuals

- Mongo standalone fallback cannot provide the same durability guarantees as a replica-set transaction setup.
- Permission/login, config editor, profile manager, dry-run/apply, restore, and real Agent provider integration are Phase 2+ work.
