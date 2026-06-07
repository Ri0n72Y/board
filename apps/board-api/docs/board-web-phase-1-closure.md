# LabourBoard Board-Web Phase 1 Closure

> Generated: 2026-06-07
> Purpose: Phase 1 sign-off, PR review handoff, next-phase planning entry point.
> Not a new PRD. Does not modify the API contract. Does not authorize Agent auto-execution.

---

## 1. Purpose

This document serves as the Phase 1 closure artifact for the LabourBoard board-web frontend and board-api backend.

It is intended for:

- PR review of the combined Phase 1 branch.
- Handoff to the main branch before Phase 2 planning.
- A stable reference for the engineering surface reached at the end of Phase 1.

This document does **not**:

- Replace the API contract (`api-contract.md`).
- Replace the backend baseline (`backend-baseline.md`).
- Authorize any Agent auto-execution, patch generation, or AI provider call.
- Define Phase 2 requirements (those are **options**, not commitments).

---

## 2. Phase 1 Scope

Phase 1 delivered a read-dominated board frontend with a manual Agent context-loop. Every Agent-related action is initiated and reviewed by a human. No AI call, no automatic board mutation, and no Agent execution is performed.

### 2.1 Current Board

- Primary entry point: `GET /api/v0/board/current`.
- Supports `q` (with 300ms debounce), `tags`, `tagMatch`, `includeArchived`, `assignee`, `assetId`, `relationTarget`.
- Projection supports `partial` / `blocked` / stale-data states.
- Stale request protection via `requestId` counters.
- `includeArchived` is a visibility toggle, not a regular filter.

### 2.2 Config / Profiles

- Reads board config for status tags, priority tags, tag definitions, pid prefix.
- Profiles are loaded for assignee display with pk fallback.
- Config/profiles failure does **not** crash the current board.

### 2.3 History

- `GET /api/v0/records/:id/history`.
- Drawer shows base record, patch chain, rolling final state, diagnostics.
- Close and fast-switch abort in-flight requests. Stale guard prevents overwrites.
- Refresh error keeps the old projection visible.

### 2.4 Create Record

- `POST /api/v0/records` — writes a new record to the board.
- Success refreshes the current board. Error stays in the create drawer.
- No direct `PUT` / `DELETE` on records.

### 2.5 Patch Edit

- Patch edit reads `GET /api/v0/records/:id/head` (dynamic current-head).
- Patch submit uses `POST /api/v0/records/:id/patches` with `currentVersion` + `parentId`.
- No dependency on `/api/v0/snapshot-head`.
- 409 conflict is surfaced. Success refreshes both current board and history.

### 2.6 Board View / Move Status

- Toggle between List View and Board View.
- Status columns derived from config. Unknown / no-status columns fall back safely.
- Status move uses the same record-head + patch flow. No `snapshot-head` access.
- Priority and custom tags preserved through moves.

### 2.7 Snapshots

- `POST /api/v0/snapshots` — creates a static checkpoint from the current board projection.
- `GET /api/v0/snapshots` — lists all snapshots.
- `GET /api/v0/snapshots/:id` — detail view.
- Snapshots do **not** participate in patch editing and do **not** replace the current board.
- Restore is **not** implemented in Phase 1.

### 2.8 Export / Context Pack

- `GET /api/v0/board/current/export` — exports current board as markdown.
- `GET /api/v0/snapshots/:id/export` — exports a snapshot as markdown.
- Export builder and context pack builder live in `packages/shared`.
- Profiles: `agent-full`, `agent-filtered`, `agent-card`, `agent-related`, `agent-sprint`, `agent-snapshot`, `human-summary`.
- Export is read-only (`GET`). No AI call is made.

### 2.9 Agent Context Registry / Env Baseline

- Agent profile definitions are registered in `packages/shared/src/constants/agentContextProfiles.ts`.
- Both `board-api` and `board-web` consume the shared registry.
- `.env.example` reserves: `AGENT_PROVIDER`, `AGENT_API_KEY`, `AGENT_MODEL`, `AGENT_BASE_URL`, `AGENT_TIMEOUT_MS`, `AGENT_ENABLED`.
- **Phase 1 does not read or use AGENT_API_KEY.** It must **never** appear in board-web source.

### 2.10 Agent Draft / Review Queue

- `POST /api/v0/agent/drafts` — creates a static Agent context draft.
- `GET /api/v0/agent/drafts` — lists drafts (summary without `contextMarkdown`).
- `GET /api/v0/agent/drafts/:id` — detail (with full `contextMarkdown`).
- Supports `current-board` and `snapshot` sources.
- `agent-filtered` drafts store the current board filters.
- Draft `contextMarkdown` is frozen at creation time. Later board changes do **not** affect the draft.
- `MongoAgentDraftRepository` is wired in; defaults to `MemoryAgentDraftRepository` without MongoDB.
- **No AI call. No AGENT_API_KEY. No run/apply/execute.**

### 2.11 Review Actions

- `PATCH /api/v0/agent/drafts/:id/review`.
- Three status transitions: `draft` → `reviewed`, `draft` → `discarded`, back to `draft`.
- Optional `reviewNote`. Timestamps `reviewedAt` / `reviewedBy`.
- Review does **not** modify `contextMarkdown`, does **not** create records/patches/snapshots.

### 2.12 Manual Handoff

- `GET /api/v0/agent/drafts/:id/handoff`.
- Only reviewed drafts can generate a formal handoff (draft/discarded → 409).
- Handoff markdown contains metadata, review metadata, manual handoff instructions, non-execution authorization, and the full original `contextMarkdown`.
- Handoff is **read-only** (`GET`). It does **not** modify draft/board/snapshots.
- `AgentDraftsDrawer` supports Copy Handoff Markdown and Download Handoff Markdown.
- Clipboard failure and abort/cancel error are handled explicitly (no silent failure).

### 2.13 Manual Agent Response

- `POST /api/v0/agent/drafts/:id/responses` — paste an external Agent reply.
- `GET /api/v0/agent/drafts/:id/responses` — list responses (summary, no `responseMarkdown`).
- `GET /api/v0/agent/responses/:responseId` — detail (with full `responseMarkdown`).
- Only `reviewed` drafts can receive responses (draft/discarded → 409).
- Response stores `draftSnapshot` (id, title, status, profile, source, reviewedAt, reviewedBy).
- Response is **static** — never parsed, never turned into a patch proposal, never executed.
- `responseMarkdown` max length: 200,000 chars.
- **No AI call. No AGENT_API_KEY. No board mutation.**

### 2.14 Readonly Timeline

- `AgentManualWorkflowTimeline` is a read-only derived component.
- Shows: Draft Created → Human Review → Formal Handoff Readiness → Manual Responses.
- No internal state (`useState`), no effects (`useEffect`), no API calls, no buttons, no `onClick`.
- Explicitly declares: _"This timeline is derived … It is not a persistent audit log. No AI call, patch, or board mutation is performed."_

### 2.15 Frontend Refactor / QA (1.17–1.19)

- `AgentDraftsDrawer` converged to a thin shell (∼190 lines).
- Thirteen sub-components extracted into `apps/board-web/src/components/agentDrafts/`.
- All cross-draft state isolation verified: review note, response form, copy feedback, handoff feedback.
- `useAgentDraftController` no longer captures `responseCtrl` as an unstable object.
- Export/Snapshot/Save Draft success/failure state handling reviewed and fixed.
- Timeline `reviewedAt` non-null assertion replaced with safe fallback.

---

## 3. User Workflow Closure

### 3.1 Board Operation Flow

```
Load Current Board
  → q debounce, tag filter, status filter, assignee/asset/relation filter
  → List View or Board View
  → Create Record
  → Edit Patch (record-head → patch submit with version guard)
  → Move Status (same head → patch flow)
  → View History (base record → patches → rolling final state)
  → Take Snapshot (static checkpoint)
  → Export as markdown
```

### 3.2 Manual Agent Workflow

```
Export Context Pack (profile, filters, include flags)
  → Save as Agent Draft (static context frozen at creation)
  → Human Review (Mark Reviewed with optional note)
  → Formal Handoff (generate markdown, manually copy to external Agent)
  → External Agent Manual Work (outside LabourBoard — Codex, ChatGPT, etc.)
  → Paste Agent Response (manual-paste markdown back into the reviewed draft)
  → Readonly Timeline Overview (derived from draft + review + responses)
```

**Critical boundaries:**

- Agent Draft is a **static context snapshot** — not a live board view.
- Review is **human metadata** — never applied to the board.
- Handoff is a **human copy-paste material** — not execution authorization.
- Response is a **human-pasted record** — not a patch proposal, not an execution result.
- Timeline is a **derived read-only view** — not a persistent audit log.
- **No step in this workflow modifies the board.**

---

## 4. API Surface Summary

### 4.1 Board / Records (writes board)

| Method | Path | Writes Board? |
|--------|------|--------------|
| GET | `/api/v0/board/current` | No |
| GET | `/api/v0/records/:id/history` | No |
| GET | `/api/v0/records/:id/head` | No |
| POST | `/api/v0/records` | Yes |
| POST | `/api/v0/records/:id/patches` | Yes (patch) |

### 4.2 Snapshots (writes snapshot, not board)

| Method | Path | Writes Board? |
|--------|------|--------------|
| POST | `/api/v0/snapshots` | No (writes snapshot) |
| GET | `/api/v0/snapshots` | No |
| GET | `/api/v0/snapshots/:id` | No |

### 4.3 Export / Context (read-only)

| Method | Path | Writes Board? |
|--------|------|--------------|
| GET | `/api/v0/board/current/export` | No |
| GET | `/api/v0/snapshots/:id/export` | No |

### 4.4 Agent (writes Agent metadata, NOT board)

| Method | Path | Writes Board? |
|--------|------|--------------|
| POST | `/api/v0/agent/drafts` | No (Agent metadata) |
| GET | `/api/v0/agent/drafts` | No |
| GET | `/api/v0/agent/drafts/:id` | No |
| PATCH | `/api/v0/agent/drafts/:id/review` | No (review metadata) |
| GET | `/api/v0/agent/drafts/:id/handoff` | No |
| POST | `/api/v0/agent/drafts/:id/responses` | No (Agent metadata) |
| GET | `/api/v0/agent/drafts/:id/responses` | No |
| GET | `/api/v0/agent/responses/:responseId` | No |

**Explicitly absent in Phase 1:**

- `POST /api/v0/agent/run` — does not exist.
- `POST /api/v0/agent/apply` — does not exist.
- `POST /api/v0/agent/execute` — does not exist.

---

## 5. Frontend Architecture Summary

### 5.1 Pages

```
BoardCurrentPage
```

The single-page composition root. It wires stores, controllers, drawers, and views. It is still sizable but functions as a declarative assembly layer rather than a logic dump.

### 5.2 Stores (Zustand)

```
boardCurrentStore   — current board projection, filters, loading/error
boardMetadataStore  — config, profiles, initial metadata load
```

### 5.3 Controllers / Hooks

| Hook | Responsibility | Abort/Stale Guard |
|------|---------------|-------------------|
| `useBoardExportController` | Export current board / context pack | Yes |
| `useSnapshotController` | Snapshot CRUD + export | Yes |
| `useRecordHistoryController` | History load | Yes |
| `useStatusMoveController` | Status move | N/A (single-shot) |
| `useAgentDraftController` | Draft CRUD + review + handoff + response orchestration | Yes |
| `useAgentResponseController` | Response CRUD lifecycle | Yes |

All controllers use `requestId` counters and `AbortController` to prevent stale writes. Close/unmount triggers abort for in-flight requests. Abort/cancel errors are filtered and never surfaced as user-facing errors.

### 5.4 API Clients

Thin wrappers around `axios`. Each file maps 1:1 to an API resource group:

```
agentDrafts.ts       — drafts CRUD, review, handoff
agentResponses.ts    — responses CRUD
boardCurrent.ts      — current board projection
exports.ts           — board/snapshot export
history.ts           — record history
patches.ts           — patch submit
recordHead.ts        — record-head fetch
records.ts           — record create / list
snapshots.ts         — snapshot CRUD
```

No API client holds business state. All state management lives in stores or controllers.

### 5.5 Agent Components

```
AgentDraftsDrawer                    — shell: overlay, layout, props distribution
  agentDrafts/
    AgentDraftQueuePanel             — draft list, status filter, refresh
    AgentDraftStatusBadge            — draft/reviewed/discarded badge
    AgentDraftSafetyBanner           — "Draft Only – Not Executed" warning
    AgentDraftMetaPanel              — draft metadata, Copy/Download Markdown
    AgentDraftReviewInfo             — reviewedAt/reviewedBy/reviewNote display
    AgentDraftReviewActions          — Mark Reviewed / Discarded / Reset
    AgentDraftContextPreview         — contextMarkdown preview (truncated)
    FormalHandoffSection             — Copy/Download Handoff, disabled reasons
    ManualAgentResponseSection       — Paste Response, response list/detail
    AgentManualWorkflowTimeline      — readonly derived timeline overview
    ErrorBlock                       — shared error display
    MetaItem                         — shared label/value display
    format                           — formatDate helper
```

---

## 6. Agent Safety Boundary

LabourBoard Phase 1 operates a **strict manual Agent boundary**:

- **LabourBoard does not call AI.** No model provider is contacted.
- **AGENT_API_KEY is never read by board-web.** It must never appear in board-web source.
- **Agent Draft is not execution authorization.**
- **Handoff is not execution authorization.**
- **Agent Response is not a patch proposal.**
- **Timeline is not a persistent audit log.**
- **No board mutation passes through the Agent workflow.**
- **No Agent run/apply/execute endpoints exist.**

### Forbidden in Phase 1

```
- /api/v0/agent/run
- /api/v0/agent/apply
- /api/v0/agent/execute
- Generate Patch
- Submit Patch
- Auto Patch
- AI provider call
- External model network request from LabourBoard
- Agent-created board mutation (record / patch / snapshot)
- AGENT_API_KEY in board-web source
```

### Allowed safety text patterns (must be preserved)

```
- "Draft Only – Not Executed"
- "No AI call has been made."
- "No patch or board mutation has been performed."
- "This does not execute the Agent."
- "This does not mutate LabourBoard."
- "This response was pasted manually."
- "Not Applied"
- "No board mutation"
- "It is not a persistent audit log."
```

The word "execute" is **only** permitted in negated safety text (e.g., "does not execute", "Not Executed"), never as a button label or actionable text.

---

## 7. State Lifecycle Rules

1. Current board requests use abort/stale guard (`requestId` + `AbortController`).
2. Metadata requests use abort/stale guard.
3. History drawer close aborts in-flight history request.
4. Create drawer close aborts in-flight create request.
5. Edit drawer uses `record-head` → `currentVersion` + `parentId` for patch submit.
6. Move status uses same record-head + patch flow. No `snapshot-head` access.
7. Snapshot drawer close aborts list/detail/create/export requests.
8. Agent draft drawer close aborts all draft + response requests.
9. Draft switching clears handoff error/feedback and aborts in-flight handoff.
10. Draft switching clears response state (form, errors, feedback) and loads new responses.
11. Draft switching resets review note via `key={draft.id}` + `useEffect`.
12. Response switching resets response copy feedback via `useEffect(selectedResponse?.id)`.
13. `useAgentDraftController` destructures stable callbacks from `useAgentResponseController` — never captures the whole returned object as a dependency.
14. Save Draft success clears `draftTitle`; failure preserves it.
15. Snapshot Save Draft failure preserves `draftTitle`.
16. Clipboard failures are visible (no silent error concealment).
17. Abort/cancel errors are filtered and **not** surfaced as user-facing errors.

---

## 8. Validation Commands

### Standard checks

```bash
pnpm --filter @labour-board/api test
pnpm --filter @labour-board/api typecheck
pnpm --filter @labour-board/web typecheck
pnpm --filter @labour-board/web build
pnpm --filter @labour-board/web lint
```

### Security scans

```bash
# Write interface scan
rg "axios\\.post|axios\\.put|axios\\.patch|axios\\.delete" apps/board-web/src

# Alternative write methods
rg "method:\\s*['\"](POST|PUT|PATCH|DELETE)['\"]|fetch\\(" apps/board-web/src

# snapshot-head leak
rg "/api/v0/snapshot-head|snapshot-head" apps/board-web/src

# patches endpoint leak
rg "/api/v0/patches" apps/board-web/src

# AGENT_API_KEY leak
rg "AGENT_API_KEY|AGENT_" apps/board-web/src

# Action button scan
rg "run|execute|apply|Auto Patch|Submit Patch|Generate Patch" apps/board-web/src/components apps/board-web/src/hooks apps/board-web/src/api
```

### Allowed patterns

- `axios.post` → `/records`, `/records/:id/patches`, `/snapshots`, `/agent/drafts`, `/agent/drafts/:id/responses`
- `axios.patch` → `/agent/drafts/:id/review`
- `axios.get` → all read endpoints
- Negated safety text containing "execute", "patch", "AI call"

### Forbidden patterns

- `axios.put`, `axios.delete`
- `fetch` with POST/PUT/PATCH/DELETE
- Any frontend reference to `/api/v0/patches`
- Any frontend reference to `/api/v0/snapshot-head`
- `AGENT_API_KEY` string in board-web source
- Actionable buttons labeled Run / Apply / Execute / Generate Patch / Submit Patch

---

## 9. Known Non-blocking Issues

The following items are known and documented. They do **not** block Phase 1 closure:

1. **BoardCurrentPage size** — it acts as a composition root and wires many drawers/controllers. It is not a logic dump, but further decomposition is desirable in Phase 2.
2. **ManualAgentResponseSection size** — the response section (∼280 lines) currently combines the paste form, response list, and response detail. If the manual response workflow expands, it should be further split (e.g., `ResponsePasteForm`, `ResponseListPanel`, `ResponseDetailPanel`).
3. **Timeline is not a persistent audit log** — it is purely derived from current draft + live response summaries. It does **not** record handoff events, review transitions, or response paste history beyond what the draft/response objects already hold.
4. **Handoff "generated at" is not persisted** — the handoff is generated on-the-fly via `GET` and is never stored as an event.
5. **IAB download smoke** — browser-level download tests are not part of the current test suite. "Download passes" means the function is invoked; no automated end-to-end browser download verification exists.
6. **Agent env baseline** — `.env.example` is reserved but `AGENT_API_KEY` is never read or used in Phase 1.
7. **Snapshot restore** — not implemented. Snapshots are read-only archives.
8. **Automatic Agent / patch proposal / apply** — explicitly excluded from Phase 1 per design. Any auto-execution capability requires a separate PRD, security review, and explicit opt-in.

---

## 10. Phase 2 Entry Options

The following are **options for discussion**, not committed requirements. None is authorized by this document.

### Option A: Manual Workflow Hardening

- Response notes edit/clear.
- Response list sorting stabilization (timestamp tie-breaking).
- Better IAB smoke scripts for Agent drawer manual workflow.
- UI polish: loading skeletons, transition animations.
- Accessibility (a11y) pass on Agent drawer.

### Option B: Snapshot Restore / Diff

- Snapshot-to-current diff.
- Restore preview (what would change).
- Restore dry-run.
- Human-confirmed restore with reason.

### Option C: Agent Response Analysis (No Apply)

- Manual or rule-based response parsing.
- Extract suggestions from pasted responses.
- Display suggestions alongside the response.
- Do **not** generate patches. Do **not** apply patches.

### Option D: Patch Proposal Draft

- From a reviewed response, create a human-reviewable patch proposal.
- Proposals are drafts — they are **not** auto-applied.
- Requires a separate PRD and explicit human review gate.

### Option E: Real Agent Integration

- Call a real AI provider (OpenAI, Codex, Anthropic, etc.).
- Use `AGENT_API_KEY` and `AGENT_ENABLED`.
- Requires a **separate PRD**, **separate security review**, and **explicit opt-in**.
- This is **not** part of Phase 1 and is **not** authorized by this document.

> **Phase 2 entry point is not yet confirmed.** This document closes Phase 1 only.

---

## 11. Final Phase 1 Handoff Checklist

```
[ ] api test passed
[ ] api typecheck passed
[ ] web typecheck passed
[ ] web build passed
[ ] web lint passed
[ ] Write interface scan passed (no axios.put/delete, no fetch write)
[ ] AGENT_API_KEY absent from board-web src
[ ] No /api/v0/patches frontend call
[ ] No snapshot-head in patch/edit/move flow
[ ] No Agent run/apply/execute endpoints
[ ] No Generate Patch / Submit Patch buttons
[ ] Phase 1 closure document reviewed
```
