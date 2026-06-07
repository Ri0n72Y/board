import { useMemo, useState } from 'react'
import type {
  AgentContextProfile,
  RecordBody,
  RecordItem,
  RecordResponse,
  Tag,
} from '@labour-board/shared'
import {
  getAgentContextProfileDefinition,
  listAgentContextProfiles,
} from '@labour-board/shared'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import type { BoardCurrentFilters } from '../api/boardCurrent'
import type { ExportContextPackOptions } from '../hooks/useBoardExportController'
import { hasEffectiveFilters } from '../utils/board'
import { Button } from './ui/Button'
import { Select } from './ui/Select'
import { SwitchField } from './ui/SwitchField'
import { TextInput } from './ui/TextInput'

interface ExportContextDrawerProps {
  open: boolean
  records: RecordResponse<RecordItem<RecordBody>>[]
  filters: BoardCurrentFilters
  knownTags: Tag[]
  isExporting: boolean
  error: string | null
  onExport: (options: ExportContextPackOptions) => boolean
  onSaveDraft?: (options: ExportContextPackOptions & { title: string }) => Promise<void>
  isSavingDraft?: boolean
  draftSaveError?: string | null
  onClose: () => void
}

export function ExportContextDrawer({
  open,
  records,
  filters,
  knownTags,
  isExporting,
  error,
  onExport,
  onSaveDraft,
  isSavingDraft = false,
  draftSaveError = null,
  onClose,
}: ExportContextDrawerProps) {
  const [profile, setProfile] = useState<AgentContextProfile>('agent-full')
  const [contextGoal, setContextGoal] = useState('')
  const [recordId, setRecordId] = useState('')
  const [sprintTag, setSprintTag] = useState('')
  const [includeContent, setIncludeContent] = useState(true)
  const [includeAssets, setIncludeAssets] = useState(true)
  const [includeRelations, setIncludeRelations] = useState(true)
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true)
  const [draftTitle, setDraftTitle] = useState('')
  const hasFilters = hasEffectiveFilters(filters)
  const profileOptions = useMemo(
    () =>
      listAgentContextProfiles('current-board').map((definition) => ({
        value: definition.id,
        label: definition.label,
      })),
    [],
  )
  const profileDefinition = useMemo(
    () => getAgentContextProfileDefinition(profile),
    [profile],
  )

  const recordOptions = useMemo(
    () => [
      { value: '', label: 'Select record' },
      ...records.map((record) => ({
        value: record.body.id,
        label: `${record.body.pid} - ${titleFromBody(record.body.body) ?? record.body.pid}`,
      })),
    ],
    [records],
  )
  const sprintOptions = useMemo(
    () => [
      { value: '', label: 'Select sprint tag' },
      ...knownTags
        .filter((tag) => tag.startsWith('sprint:'))
        .sort((a, b) => a.localeCompare(b))
        .map((tag) => ({ value: tag, label: tag })),
    ],
    [knownTags],
  )

  if (!open) return null

  const needsRecord = profileDefinition.requiresRecord
  const needsSprint = profileDefinition.requiresSprint

  const handleProfileChange = (nextProfile: AgentContextProfile) => {
    const definition = getAgentContextProfileDefinition(nextProfile)
    setProfile(nextProfile)
    setIncludeContent(definition.defaultIncludeContent)
    setIncludeAssets(definition.defaultIncludeAssets)
    setIncludeRelations(definition.defaultIncludeRelations)
    setIncludeDiagnostics(definition.defaultIncludeDiagnostics)
    if (!definition.requiresRecord) setRecordId('')
    if (!definition.requiresSprint) setSprintTag('')
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/30"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        aria-labelledby="context-pack-title"
        aria-modal="true"
        className="ml-auto grid h-full w-full max-w-xl grid-rows-[auto_1fr_auto] overflow-hidden border-l border-slate-200 bg-stone-50 text-slate-950 shadow-xl"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-slate-500">
              Export
            </p>
            <h2 className="text-xl font-semibold" id="context-pack-title">
              Context Pack
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            title="Close context pack"
            icon={<XMarkIcon className="h-4 w-4" />}
          >
            Close
          </Button>
        </header>

        <div className="grid content-start gap-4 overflow-y-auto px-5 py-4">
          <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <Select
              label="Profile"
              value={profile}
              onChange={(event) =>
                handleProfileChange(event.target.value as AgentContextProfile)
              }
              options={profileOptions}
            />
            <p className="text-sm text-slate-600">
              {profileDefinition.description}
            </p>
            <p className="text-xs text-slate-500">
              {profileDefinition.agentReadingPurpose}
            </p>
            <label className="grid gap-1.5 text-xs font-bold text-slate-500">
              Context goal
              <textarea
                className="min-h-24 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                value={contextGoal}
                onChange={(event) => setContextGoal(event.target.value)}
                placeholder="Optional goal for the exported context"
              />
            </label>
            {profileDefinition.usesCurrentFilters && !hasFilters && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No active filters. This context will export the current visible board scope.
              </p>
            )}
          </section>

          {(needsRecord || needsSprint) && (
            <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
              {needsRecord && (
                <Select
                  label="Record"
                  value={recordId}
                  onChange={(event) => setRecordId(event.target.value)}
                  options={recordOptions}
                />
              )}
              {needsSprint && sprintOptions.length > 1 ? (
                <Select
                  label="Sprint tag"
                  value={sprintTag}
                  onChange={(event) => setSprintTag(event.target.value)}
                  options={sprintOptions}
                />
              ) : null}
              {needsSprint && sprintOptions.length <= 1 ? (
                <TextInput
                  label="Sprint tag"
                  value={sprintTag}
                  onChange={(event) => setSprintTag(event.target.value)}
                  placeholder="sprint:1"
                />
              ) : null}
            </section>
          )}

          <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-xs font-bold uppercase text-slate-500">
              Include
            </h3>
            <SwitchField
              label="Full content"
              checked={includeContent}
              onChange={setIncludeContent}
            />
            <SwitchField
              label="Assets"
              checked={includeAssets}
              onChange={setIncludeAssets}
            />
            <SwitchField
              label="Relations"
              checked={includeRelations}
              onChange={setIncludeRelations}
            />
            <SwitchField
              label="Diagnostics"
              checked={includeDiagnostics}
              onChange={setIncludeDiagnostics}
            />
          </section>

          {error && (
            <section
              className="grid gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              <strong>Export failed</strong>
              <span>{error}</span>
            </section>
          )}

          {onSaveDraft && (
            <section className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="text-xs font-bold uppercase text-emerald-700">
                Save as Agent Draft
              </h3>
              <p className="text-xs text-emerald-800">
                Save the current context pack as a static Agent Session Draft for human review before handing to an Agent.
              </p>
              <TextInput
                label="Draft title"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder="e.g. Review Sprint 1 board"
              />
              {draftSaveError && (
                <section
                  className="grid gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
                  role="alert"
                >
                  <strong>Draft save failed</strong>
                  <span>{draftSaveError}</span>
                </section>
              )}
              <Button
                type="button"
                disabled={!draftTitle.trim() || isSavingDraft}
                onClick={() => {
                  if (!draftTitle.trim()) return
                  onSaveDraft({
                    title: draftTitle.trim(),
                    profile,
                    contextGoal,
                    recordId: recordId || undefined,
                    sprintTag: sprintTag || undefined,
                    includeContent,
                    includeAssets,
                    includeRelations,
                    includeDiagnostics,
                  })
                    .then(() => {
                      setDraftTitle('')
                    })
                    .catch(() => {
                      // Title preserved on failure
                    })
                }}
                icon={
                  isSavingDraft ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  ) : undefined
                }
              >
                {isSavingDraft ? 'Saving...' : 'Save as Agent Draft'}
              </Button>
            </section>
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white px-5 py-4">
          <Button
            type="button"
            disabled={isExporting}
            onClick={() =>
              onExport({
                profile,
                contextGoal,
                recordId: recordId || undefined,
                sprintTag: sprintTag || undefined,
                includeContent,
                includeAssets,
                includeRelations,
                includeDiagnostics,
              })
            }
            icon={
              isExporting ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowDownTrayIcon className="h-4 w-4" />
              )
            }
          >
            {isExporting ? 'Exporting...' : 'Export Markdown'}
          </Button>
        </footer>
      </aside>
    </div>
  )
}

function titleFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const value = (body as Record<string, unknown>).title
  return typeof value === 'string' && value.trim() ? value : undefined
}
