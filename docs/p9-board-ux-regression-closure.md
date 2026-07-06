# P9 Board UX Regression Closure

## Status

Draft regression checklist for the post-P3-to-P8 Board UX closure pass.

This task is a stage-closure review, not a product feature. It must verify that the current `master` can be treated as a stable Board UX baseline after the toast, tag-config, DnD, and Board structure refactors.

## Scope

P9 covers the integrated user-facing paths affected by these completed tasks:

- P3 toast system formalization.
- P4 read-only tag config visualization.
- P5 DnD status move.
- P6 Board DnD structure extraction.
- P7 Board column/card wrapper extraction.
- P8 Board view-model hook extraction.

## Non-goals

P9 must not introduce new product behavior.

Do not add:

- New backend routes.
- New DnD sorting or rank keys.
- Optimistic reorder.
- Agent auto-apply or direct mutation.
- Tag config mutation.
- Permission or login changes.
- Export format changes.
- Snapshot semantics changes.
- Broad i18n rewrites.

If the regression pass finds defects, fix them with narrow follow-up PRs that name the failing path. Do not hide fixes inside the checklist update.

## Required static validation

Run these commands before smoke validation:

- `pnpm --filter @labour-board/api typecheck`
- `pnpm --filter @labour-board/web typecheck`
- `pnpm --filter @labour-board/web lint`
- `pnpm --filter @labour-board/web build`

If API validation has an environmental blocker, record the exact blocker and still run all web validation.

## Board view regression

Validate the current board in both English and Chinese UI where relevant.

- Board view loads from `/board/current` without runtime application errors.
- Default visible status columns render correctly.
- Column labels update when language switches.
- Uncategorized label updates when language switches.
- Record count badges match the rendered records in each visible column.
- List view still renders all records and does not show drag handles.
- Board/List switching does not lose the current route or crash.
- Card body click still opens record detail.
- Drag handle click does not open record detail.

## Visible columns and hidden-column notice

Validate the settings-driven visible-column behavior.

- Hiding a visible status column removes that column from the board.
- Restoring a hidden status column restores it to the board.
- Hidden columns are not registered as DnD drop targets.
- The hidden-column toast appears only when records are hidden by column visibility.
- The hidden-column toast count matches hidden status-column record count.
- Hidden Uncategorized record notice still appears when applicable.
- Re-entering the same board state does not spam duplicate hidden-column toasts.
- Changing visible-column settings can show the notice again with updated counts.

## DnD status move regression

Validate status movement without changing the P5 boundary.

- Dragging a card to a different visible status column performs exactly one move operation.
- A valid move uses `GET /records/:id/head`, then one `POST /records/:id/patches`, then refreshes current board data.
- Same-column drop is a no-op and sends no move request.
- Drop outside a column is a no-op and sends no move request.
- Dragging over a valid target and releasing outside it is a no-op.
- Hidden columns are not valid drop targets.
- Uncategorized is not a valid drop target.
- Pending move disables additional drag handles or otherwise blocks second move submission.
- Failure response is surfaced inline on the affected card.
- A conflict or stale-head failure does not move the card optimistically.
- After a failed move, the UI remains aligned with server projection.
- No new backend route is called for DnD.

## Move To fallback regression

Validate the keyboard-accessible fallback path.

- Move To select remains visible in board card compact mode.
- Move To select is not shown as a drag handle in List view.
- Select-based move uses the same head + patch + refresh path as DnD.
- Select-based same-status selection is disabled or no-op.
- During pending move, the select is disabled.
- Failure is surfaced inline on the affected card.

## Record detail and edit drawer regression

Validate that Board interactions still preserve record drawer semantics.

- Card body opens record detail drawer.
- Detail drawer can close without losing board render state.
- Edit from detail opens the human edit flow, not an Agent mutation path.
- Save edit still uses the canonical record patch path.
- Dirty-state warning still protects unsaved edits where applicable.
- Moving a record and then opening detail shows refreshed record status after board refresh.

## Agent suggestion boundary regression

Validate that Agent suggestions remain read-only artifacts until a human opens a draft.

- Agent suggestion generation still renders summary, highlights, and details.
- Agent suggestion does not directly mutate board records.
- Patch Draft opens the human edit drawer or human review path.
- Submitting changes still goes through the canonical record patch flow.
- Suggestion detail and board refresh do not desynchronize current record head.
- No Agent apply/run/execute mutation route is introduced.

## Snapshot and export regression

Validate that unrelated board workflows were not regressed.

- Snapshot creation still works.
- Snapshot success/failure feedback uses the toast system.
- Current board export still works.
- Snapshot export still works.
- Export feedback uses the toast system.
- Export content still reflects current board projection, not hidden-column-only view state unless explicitly designed otherwise.

## Tag config read-only regression

Validate the P4 read-only boundary.

- Tag config panel opens from Settings.
- Status, priority, asset, transaction, default, custom, locked, and snapshot-excluded tags remain visible where data exists.
- Panel remains read-only.
- No edit, save, delete, or mutation control is exposed.
- No tag config mutation API is called.

## State and concurrency checks

Validate user-visible state safety.

- A pending status move prevents duplicate patches for the same gesture.
- Rapid repeated drop attempts do not create multiple patches.
- Board refresh after move does not reopen or corrupt unrelated drawers.
- Drawer state remains stable while board refreshes.
- Move errors are scoped to the affected record.
- Moving one record does not leave another record in pending state.
- URL filter and visible-column state remain stable across refresh and back/forward navigation.

## Engineering boundary review

Inspect the code after the smoke pass.

- `BoardView` remains a top-level assembly component.
- `useBoardViewModel` contains board projection/view-model derivation only.
- `useBoardStatusDnd` contains DnD behavior only.
- `BoardStatusDropColumn` contains column render and draggable card wrapper only.
- `RecordCard` remains record presentation and card-level interactions.
- `useStatusMoveController` remains the owner of head + patch + refresh move mutation semantics.
- No duplicated status move logic is introduced.
- No hidden optimistic state is introduced.
- No user-visible hardcoded English is introduced without i18n fallback.

## Closure decision format

The final report must classify P9 as one of:

- `PASS`: Main Board UX baseline can be treated as stage-closed.
- `PASS_WITH_FOLLOW_UP`: Baseline is usable, but specific non-blocking issues should become follow-up tasks.
- `BLOCKED`: Environmental issue prevents meaningful validation.
- `FAIL`: A regression exists and should be fixed before new feature work.

The report must include:

- Branch and commit used.
- Static validation results.
- Browser smoke results.
- Any environment blockers.
- Any changed files.
- Network route observations.
- Console error observations.
- Final closure classification.
