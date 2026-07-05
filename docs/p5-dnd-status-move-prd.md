# P5: Drag-and-drop status move PRD

## Status

Draft for implementation review. This document defines the product and engineering boundary before any drag-and-drop implementation.

## Goal

Replace the board card `Move To` select workflow with a drag-and-drop status move workflow on the board view, while preserving the existing record patch safety model.

The first implementation should support moving a card from one visible status column to another visible status column. It should not introduce arbitrary card ordering within a column.

## Current behavior

Current status movement is centralized in `useStatusMoveController`:

- Fetch the current record head.
- Build status tag changes.
- Submit a record patch with `parentId` and `currentVersion`.
- Refresh the current board after success.
- Store per-record move errors.

`BoardView` builds status columns from current config/projection, derives move options from those columns, and passes move state into compact `RecordCard` instances. `RecordCard` renders `MoveStatusControl` only in compact board cards.

## Non-goals

Do not implement these in P5:

- Arbitrary ordering of cards within a column.
- Persisted rank/sort keys.
- Dragging records across non-status groupings.
- Moving records into hidden columns.
- Editing tag config.
- Changing patch API semantics.
- Adding any direct mutation path that bypasses `useStatusMoveController` / canonical record patch submit.
- Removing keyboard-accessible movement before an equivalent keyboard path exists.

## Required product behavior

### Board drag behavior

- A card can be dragged from one visible status column to another visible status column.
- Drop targets are visible status columns only.
- Dropping on the same status is a no-op.
- Dropping outside a valid column is a no-op.
- Hidden columns are not drop targets.
- Uncategorized columns without a valid `status:*` tag are not drop targets.
- During a move request, the moving card should visibly indicate pending state.
- A move failure should leave the board data consistent with the last loaded server projection and display a per-record error.

### Mutation behavior

- DnD must call the same status move path as the existing select workflow.
- DnD must not submit a patch using stale local assumptions without fetching current record head.
- DnD must keep `parentId` and `currentVersion` CAS behavior.
- DnD must keep current conflict handling.
- The patch description can continue to use the existing `Move old -> new` style.

### Refresh and optimistic UI

P5 should start with a conservative non-optimistic implementation:

- On drop, call the move controller.
- Keep the card in its current column until the board refresh returns.
- Show pending state while the request is active.
- On success, refresh updates the card location.
- On failure, show the existing inline record move error.

Optimistic local movement can be considered later only after rollback behavior is explicitly designed.

### Accessibility

DnD alone is not sufficient. P5 must preserve a keyboard-accessible move path.

Acceptable first implementation:

- Keep `MoveStatusControl` available as a compact card fallback, or
- replace it with an equivalent keyboard-accessible action menu.

Do not remove the existing select until the replacement supports keyboard-only movement and screen-reader labeling.

### Touch and pointer behavior

Desktop pointer drag is in scope. Touch behavior can be supported if the selected library provides it safely, but P5 must not regress click-to-open card details.

Interactive elements inside cards must continue to avoid triggering card detail open accidentally.

## Engineering constraints

### State ownership

- `useStatusMoveController` remains the owner of status move mutation state.
- `BoardView` can own drag hover/active visual state.
- `RecordCard` should remain a display component with explicit drag props if needed.
- Do not move board projection ownership out of `boardCurrentStore`.

### API boundary

No backend changes are expected for P5.

The implementation should continue to use:

- `fetchRecordHead`
- `submitRecordPatch`
- `buildMovedStatusTagChanges`
- `isStatusMoveNoop`

### Library boundary

Before coding, inspect package availability. If adding a DnD library is necessary, justify it in the implementation notes and keep usage isolated to board drag behavior. Do not introduce a project-wide DnD abstraction before this feature proves stable.

### Error handling

- Conflict errors must remain visible and actionable.
- Aborted/superseded moves must not leave stale pending state.
- Concurrent moves should not corrupt per-record error state.
- A second move attempt while one move is pending should either be blocked or explicitly serialized. P5 should prefer blocking for simplicity.

## Proposed implementation stages

### P5.1: Topology and guardrails

- Identify exact drag/drop insertion points in `BoardView` and `RecordCard`.
- Confirm whether a DnD library is already installed.
- Decide fallback accessibility path.
- Confirm no backend/API changes are required.

### P5.2: Minimal drag move

- Add drag source behavior to compact board cards.
- Add drop target behavior to visible status columns.
- Call the existing `onMoveStatus(record, targetStatusTag)` on valid drop.
- Preserve existing `MoveStatusControl` fallback.
- Add pending style and invalid-drop no-op behavior.

### P5.3: Hardening

- Verify hidden columns are not drop targets.
- Verify same-column drop is no-op.
- Verify conflict/failure displays inline error.
- Verify click-to-open card detail still works.
- Verify keyboard fallback works.

## Acceptance criteria

- Dragging a card to another visible status column submits exactly one status patch through the existing move controller.
- Same-column drag/drop does not submit a patch.
- Invalid drop does not submit a patch.
- Hidden status columns are not drop targets.
- Current board refresh moves the card after success.
- Conflict/failure leaves the card in the server-projected location and shows a move error.
- Keyboard-accessible movement remains available.
- Card click-to-open still works.
- Record detail, edit drawer, Agent, Toast, Settings, Tag config, export, and snapshot flows are not modified.

## Validation checklist

Static:

- `pnpm --filter @labour-board/web typecheck`
- `pnpm --filter @labour-board/web lint`
- `pnpm --filter @labour-board/web build`

Smoke:

- Drag Todo card to Doing/Done visible column.
- Drag card to same column.
- Drop card outside columns.
- Hide a status column and verify it is not a drop target.
- Trigger or simulate conflict/failure and verify inline error.
- Use keyboard fallback to move status.
- Click card body to open detail.
- Interact with card controls without opening detail accidentally.
- Confirm no new backend route or direct mutation path was added.
