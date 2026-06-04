import { useState } from 'react'
import type { BoardCurrentTagMatch, Tag } from '@labour-board/shared'
import {
  MagnifyingGlassIcon,
  TagIcon,
  UserIcon,
  HashtagIcon,
  LinkIcon,
} from '@heroicons/react/20/solid'
import { Button } from './ui/Button'
import { TextInput } from './ui/TextInput'
import { Select } from './ui/Select'
import { SwitchField } from './ui/SwitchField'
import { Panel } from './ui/Panel'
import { cn } from '../lib/cn'

interface BoardFiltersProps {
  q: string
  tags: Tag[]
  tagMatch: BoardCurrentTagMatch
  includeArchived: boolean
  assignee: string
  assetId: string
  relationTarget: string
  knownTags: Tag[]
  onQChange: (q: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: Tag) => void
  onTagMatchChange: (tagMatch: BoardCurrentTagMatch) => void
  onIncludeArchivedChange: (includeArchived: boolean) => void
  onAssigneeChange: (assignee: string) => void
  onAssetIdChange: (assetId: string) => void
  onRelationTargetChange: (relationTarget: string) => void
}

const TAG_MATCH_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'any', label: 'Any' },
]

export function BoardFilters({
  q,
  tags,
  tagMatch,
  includeArchived,
  assignee,
  assetId,
  relationTarget,
  knownTags,
  onQChange,
  onAddTag,
  onRemoveTag,
  onTagMatchChange,
  onIncludeArchivedChange,
  onAssigneeChange,
  onAssetIdChange,
  onRelationTargetChange,
}: BoardFiltersProps) {
  const [tagInput, setTagInput] = useState('')

  function submitTag() {
    onAddTag(tagInput)
    setTagInput('')
  }

  return (
    <>
      <Panel className="p-4" aria-label="Board filters">
        <div className="grid gap-3 lg:grid-cols-4">
          <TextInput
            label="Search current text"
            value={q}
            onChange={(event) => onQChange(event.target.value)}
            placeholder="title, description, content"
            icon={<MagnifyingGlassIcon className="h-4 w-4" />}
          />

          <TextInput
            label="Tag"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submitTag()
              }
            }}
            placeholder="status:todo"
            icon={<TagIcon className="h-4 w-4" />}
            after={
              <Button type="button" onClick={submitTag} className="shrink-0 rounded-l-none">
                Add
              </Button>
            }
          />

          <Select
            label="Tag match"
            value={tagMatch}
            onChange={(event) =>
              onTagMatchChange(event.target.value as BoardCurrentTagMatch)
            }
            options={TAG_MATCH_OPTIONS}
          />

          <div className="flex flex-col justify-end gap-3">
            <TextInput
              label="Assignee"
              value={assignee}
              onChange={(event) => onAssigneeChange(event.target.value)}
              placeholder="public key"
              icon={<UserIcon className="h-4 w-4" />}
            />
            <SwitchField
              label="Include archived"
              checked={includeArchived}
              onChange={onIncludeArchivedChange}
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <TextInput
            label="Asset ID"
            value={assetId}
            onChange={(event) => onAssetIdChange(event.target.value)}
            placeholder="record id"
            icon={<HashtagIcon className="h-4 w-4" />}
          />
          <TextInput
            label="Relation target"
            value={relationTarget}
            onChange={(event) => onRelationTargetChange(event.target.value)}
            placeholder="record id"
            icon={<LinkIcon className="h-4 w-4" />}
          />
        </div>
      </Panel>

      {(tags.length > 0 || knownTags.length > 0) && (
        <Panel className="mt-3 px-4 py-3" aria-label="Tag filters">
          {tags.length > 0 && (
            <TagChipRow
              label="Active"
              tags={tags}
              selected
              onTagClick={onRemoveTag}
            />
          )}
          {knownTags.length > 0 && (
            <TagChipRow label="Known" tags={knownTags} onTagClick={onAddTag} />
          )}
        </Panel>
      )}
    </>
  )
}

/* ─── TagChipRow ─── */

interface TagChipRowProps {
  label?: string
  tags: Tag[]
  selected?: boolean
  readonly?: boolean
  onTagClick?: (tag: Tag) => void
}

export function TagChipRow({
  label,
  tags,
  selected = false,
  readonly = false,
  onTagClick,
}: TagChipRowProps) {
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="text-xs font-bold text-slate-500">{label}</span>}
      {tags.map((tag) =>
        readonly || !onTagClick ? (
          <span className={chipClassName({ selected, readonly })} key={tag}>
            {tag}
          </span>
        ) : (
          <button
            className={chipClassName({ selected })}
            key={tag}
            type="button"
            onClick={() => onTagClick(tag)}
            title={selected ? 'Remove tag filter' : 'Add tag filter'}
          >
            {tag}
          </button>
        )
      )}
    </div>
  )
}

function chipClassName({
  selected,
  readonly,
}: {
  selected: boolean
  readonly?: boolean
}) {
  return cn(
    'inline-flex min-h-[30px] max-w-full items-center rounded-full bg-slate-100 px-2.5 font-mono text-xs leading-tight text-slate-700 break-all',
    selected && 'border border-emerald-700 bg-emerald-100 text-emerald-800',
    readonly && 'border border-slate-200'
  )
}
