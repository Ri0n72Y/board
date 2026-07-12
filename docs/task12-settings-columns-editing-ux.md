# Task 12: Settings, Column Order, Board Cleanup, and Edit Focus UX

## Purpose

Implement the first post-P9 Board UX iteration by combining P10, P11, P12, and P15 into one task with internal checkpoints.

This task intentionally does not implement persistent card ordering. Persistent board-view ordering is reserved for the next task.

## Scope

This task includes:

1. Move Settings out of the More menu into a standalone header button.
2. Split Settings into tabs.
3. Move tag configuration into its own Settings tab.
4. Manage visible columns and column ordering in a Board Settings tab.
5. Use DnD in Settings for column reordering.
6. Remove the compact Board card Move To control.
7. Simplify empty-column no-record styling.
8. Add single active edit field and dirty-but-inactive field styling in the edit drawer.

## Non-goals

Do not implement:

- Persistent card ordering.
- Cross-column card insertion persistence.
- Card rank or order fields.
- Board-view backend preference storage.
- Tag mutation.
- Agent apply/direct mutation.
- Snapshot/export semantic changes.
- Record patch protocol changes.
- Backend changes.

## Important boundary decisions

### Column ordering in this task

Column order is only a frontend Board display preference in this task.

It may continue to use the existing frontend preference mechanism for now, but the code should be structured so it can later be replaced by backend board-view preference storage.

The current implementation stores visible columns in localStorage. This task may extend that preference to include column order.

### Card ordering is not part of this task

Do not add card order, card rank, or card insertion persistence.

DnD record movement must remain status movement only and must still use the existing head + patch + refresh flow.

### Move To removal

Remove the Move To control from compact Board cards.

Do not remove the status move controller. DnD status move remains supported.

If removing Move To also removes the inline status move error display, add a lightweight status move error display back to the compact card.

A keyboard-accessible status move replacement can be listed as a follow-up; do not invent it in this task.

### Edit drawer focus and dirty fields

The edit drawer should support:

- One active field at a time.
- Clicking a different field deactivates the previous field.
- Clicking blank space deactivates the active field.
- Clean inactive fields use normal styling.
- Dirty inactive fields keep a dirty border.
- Active fields keep focus/active styling.
- Field focus changes must not discard form data.
- Saving must still use the existing patch-draft and head/conflict flow.

Do not rewrite the edit submit flow.

## Checkpoints

### Checkpoint A: Header and Settings tabs

Expected changes:

- Add a standalone Settings button in the header.
- Remove Settings from the More menu.
- Keep More menu actions for Snapshots, Export, Context Pack, and Agent Drafts.
- Convert AppSettingsDrawer to tabs.
- Put language and members under General or equivalent.
- Put visible columns and column order under Board.
- Put TagConfigReadOnlyPanel under Tags.
- Keep tag configuration read-only.

Validation:

- Settings button is visible.
- Settings opens from the standalone button.
- More no longer contains Settings.
- Existing More actions still work.
- Settings tabs switch correctly.
- Tags tab is read-only.
- Language and members still work.

### Checkpoint B: Column visibility and order

Expected changes:

- Extend Board column preference to preserve both visibility and order.
- Preserve backward compatibility with the existing stored visible-column array.
- Add DnD column ordering in the Board settings tab.
- BoardView renders visible columns in the saved order.
- Hidden and restored columns keep stable ordering.
- New status columns append to the end.

Validation:

- Hide/restore status columns.
- Reorder columns in Settings.
- Board reflects the order.
- Refresh preserves the order.
- Hidden/restore does not corrupt ordering.
- No backend route is added for this task.

### Checkpoint C: Board card cleanup

Expected changes:

- Remove Move To from compact Board cards.
- Keep DnD drag handle.
- Keep click-to-open behavior.
- Keep move error visibility.
- Simplify empty no-record styling so the empty state has no obvious border/background.

Validation:

- Board compact cards do not show Move To.
- DnD status move still works.
- Same-column and invalid drops are still no-op.
- Drag handle click does not open detail.
- Card body click opens detail.
- Move failure still has a visible error on the affected card.
- List view does not show drag handle or Move To.
- Empty column no-record state has no obvious border/background.

### Checkpoint D: Edit drawer focus and dirty-field UX

Expected changes:

- Add a lightweight active field state to EditRecordDrawer.
- Add dirty-field detection against the initial record state.
- Apply active and dirty-inactive styling to title, summary, details, assignee, status, priority, other tags, assets, and relations as feasible.
- Do not rewrite submit/head/conflict logic.

Validation:

- Click title field: title becomes active.
- Click summary without changing title: title becomes inactive and clean.
- Change title then click summary: title becomes dirty inactive.
- Change summary then click details: summary becomes dirty inactive.
- Click blank space: active field deactivates.
- Dirty fields keep data.
- Save still submits a valid patch.
- Conflict/head behavior is unchanged.

## Static validation

Run:

- `pnpm --filter @labour-board/web typecheck`
- `pnpm --filter @labour-board/web lint`
- `pnpm --filter @labour-board/web build`

If any shared/API file is changed unexpectedly, also run:

- `pnpm --filter @labour-board/api typecheck`

## Browser smoke summary

Required paths:

- Settings external button.
- More menu without Settings.
- Existing More actions.
- Settings tabs.
- Tags read-only panel.
- Language switch.
- Members manager.
- Visible column hide/restore.
- Column reorder and refresh persistence.
- Board cards without Move To.
- DnD valid move.
- Same-column no-op.
- Invalid drop no-op.
- Move error display.
- List view.
- Empty column style.
- Edit drawer active/dirty field behavior.
- Save patch.
- Network routes.
- Console errors.

## Report format

The final validation report should include:

- Branch.
- Commits by checkpoint.
- Static validation results.
- Browser smoke results.
- Changed files.
- Network route observations.
- Console observations.
- Follow-ups.
- Final conclusion.
