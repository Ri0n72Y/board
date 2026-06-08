import { useCallback, useMemo, useRef, useState } from 'react'
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
  DocumentMagnifyingGlassIcon,
} from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import type { BoardCurrentFilters } from '../api/boardCurrent'
import { exportCurrentBoard } from '../api/exports'
import type { ExportContextPackOptions } from '../hooks/useBoardExportController'
import { hasEffectiveFilters } from '../utils/board'
import { formatTagLabel } from '../utils/tagDisplay'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { MarkdownPreview } from './ui/MarkdownPreview'
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
  const { t, i18n } = useTranslation()
  const [profile, setProfile] = useState<AgentContextProfile>('agent-full')
  const [contextGoal, setContextGoal] = useState('')
  const [recordId, setRecordId] = useState('')
  const [sprintTag, setSprintTag] = useState('')
  const [includeContent, setIncludeContent] = useState(true)
  const [includeAssets, setIncludeAssets] = useState(true)
  const [includeRelations, setIncludeRelations] = useState(true)
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true)
  const [draftTitle, setDraftTitle] = useState('')

  // Preview state
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewRequestIdRef = useRef(0)
  const previewAbortRef = useRef<AbortController | null>(null)

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
      { value: '', label: t('export.recordPlaceholder') },
      ...records.map((record) => ({
        value: record.body.id,
        label: `${record.body.pid} - ${titleFromBody(record.body.body) ?? record.body.pid}`,
      })),
    ],
    [records, t],
  )
  const sprintOptions = useMemo(
    () => [
      { value: '', label: t('export.sprintTag') },
      ...knownTags
        .filter((tag) => tag.startsWith('sprint:'))
        .sort((a, b) => a.localeCompare(b))
        .map((tag) => ({ value: tag, label: formatTagLabel(tag, t) })),
    ],
    [knownTags, t],
  )

  const needsRecord = profileDefinition.requiresRecord
  const needsSprint = profileDefinition.requiresSprint

  const handleProfileChange = useCallback((nextProfile: AgentContextProfile) => {
    const definition = getAgentContextProfileDefinition(nextProfile)
    setProfile(nextProfile)
    setIncludeContent(definition.defaultIncludeContent)
    setIncludeAssets(definition.defaultIncludeAssets)
    setIncludeRelations(definition.defaultIncludeRelations)
    setIncludeDiagnostics(definition.defaultIncludeDiagnostics)
    if (!definition.requiresRecord) setRecordId('')
    if (!definition.requiresSprint) setSprintTag('')
    // Clear stale preview
    clearPreview()
  }, [])

  function clearPreview() {
    previewAbortRef.current?.abort()
    previewAbortRef.current = null
    setPreviewContent(null)
    setPreviewError(null)
  }

  const handlePreview = useCallback(() => {
    const requestId = previewRequestIdRef.current + 1
    previewRequestIdRef.current = requestId
    previewAbortRef.current?.abort()

    const controller = new AbortController()
    previewAbortRef.current = controller
    setIsPreviewLoading(true)
    setPreviewError(null)
    setPreviewContent(null)

    void exportCurrentBoard(
      {
        profile,
        language: i18n.language,
        contextGoal: contextGoal.trim() || undefined,
        recordId: recordId || undefined,
        sprintTag: sprintTag || undefined,
        filters: profileDefinition.usesCurrentFilters ? filters : undefined,
        includeDiagnostics,
        includeRelations,
        includeAssets,
        includeContent,
      },
      controller.signal,
    )
      .then((data) => {
        if (previewRequestIdRef.current !== requestId || controller.signal.aborted) return
        setPreviewContent(data.content)
      })
      .catch((caught: unknown) => {
        if (previewRequestIdRef.current !== requestId || controller.signal.aborted || axios.isCancel(caught)) return
        setPreviewError(caught instanceof Error ? caught.message : String(caught))
      })
      .finally(() => {
        if (previewRequestIdRef.current !== requestId) return
        setIsPreviewLoading(false)
        previewAbortRef.current = null
      })
  }, [profile, contextGoal, recordId, sprintTag, includeDiagnostics, includeRelations, includeAssets, includeContent, filters, profileDefinition, i18n.language])

  const handleExportClick = useCallback(() => {
    clearPreview()
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
  }, [onExport, profile, contextGoal, recordId, sprintTag, includeContent, includeAssets, includeRelations, includeDiagnostics])

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button
        type="button"
        disabled={isExporting}
        onClick={handleExportClick}
        icon={
          isExporting ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowDownTrayIcon className="h-4 w-4" />
          )
        }
      >
        {isExporting ? t('export.exporting') : t('export.exportButton')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={isPreviewLoading}
        onClick={handlePreview}
        icon={
          isPreviewLoading ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : (
            <DocumentMagnifyingGlassIcon className="h-4 w-4" />
          )
        }
      >
        {isPreviewLoading ? t('export.exporting') : t('export.previewButton')}
      </Button>
    </div>
  )

  return (
    <AnimatedDrawer
      open={open}
      onClose={onClose}
      title={t('export.title')}
      subtitle={t('export.subtitle')}
      closeLabel={t('export.close')}
      footer={footer}
    >
      <div className="grid content-start gap-4">
        {/* Profile section */}
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <Select
            label={t('export.profile')}
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
            {t('export.contextGoal')}
            <textarea
              className="min-h-24 resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              value={contextGoal}
              onChange={(event) => setContextGoal(event.target.value)}
              placeholder={t('export.contextGoalPlaceholder')}
            />
          </label>
          {profileDefinition.usesCurrentFilters && !hasFilters && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t('export.noFiltersNote')}
            </p>
          )}
        </section>

        {/* Record / Sprint selectors */}
        {(needsRecord || needsSprint) && (
          <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
            {needsRecord && (
              <Select
                label={t('export.record')}
                value={recordId}
                onChange={(event) => setRecordId(event.target.value)}
                options={recordOptions}
              />
            )}
            {needsSprint && sprintOptions.length > 1 ? (
              <Select
                label={t('export.sprintTag')}
                value={sprintTag}
                onChange={(event) => setSprintTag(event.target.value)}
                options={sprintOptions}
              />
            ) : null}
            {needsSprint && sprintOptions.length <= 1 ? (
              <TextInput
                label={t('export.sprintTag')}
                value={sprintTag}
                onChange={(event) => setSprintTag(event.target.value)}
                placeholder={t('export.sprintTagPlaceholder')}
              />
            ) : null}
          </section>
        )}

        {/* Include toggles */}
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-bold uppercase text-slate-500">
            {t('export.include')}
          </h3>
          <SwitchField
            label={t('export.fullContent')}
            checked={includeContent}
            onChange={setIncludeContent}
          />
          <SwitchField
            label={t('export.includeAssets')}
            checked={includeAssets}
            onChange={setIncludeAssets}
          />
          <SwitchField
            label={t('export.includeRelations')}
            checked={includeRelations}
            onChange={setIncludeRelations}
          />
          <SwitchField
            label={t('export.includeDiagnostics')}
            checked={includeDiagnostics}
            onChange={setIncludeDiagnostics}
          />
        </section>

        {/* Export error */}
        {error && (
          <section
            className="grid gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            <strong>{t('export.exportFailed')}</strong>
            <span>{error}</span>
          </section>
        )}

        {/* Markdown Preview */}
        {(previewContent !== null || isPreviewLoading || previewError) && (
          <section className="grid gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-500">
              {t('export.previewTitle')}
            </h3>
            <MarkdownPreview
              content={previewContent}
              isLoading={isPreviewLoading}
              error={previewError}
              loadingMessage={t('export.exporting')}
              emptyMessage={t('export.previewEmpty')}
            />
          </section>
        )}

        {/* Save as Agent Draft */}
        {onSaveDraft && (
          <section className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="text-xs font-bold uppercase text-emerald-700">
              {t('export.draftSectionTitle')}
            </h3>
            <p className="text-xs text-emerald-800">
              {t('export.draftDescription')}
            </p>
            <TextInput
              label={t('export.draftTitle')}
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder={t('export.draftPlaceholder')}
            />
            {draftSaveError && (
              <section
                className="grid gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                <strong>{t('export.draftSaveError')}</strong>
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
              {isSavingDraft ? t('export.draftSaving') : t('export.draftSaveButton')}
            </Button>
          </section>
        )}
      </div>
    </AnimatedDrawer>
  )
}

function titleFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const value = (body as Record<string, unknown>).title
  return typeof value === 'string' && value.trim() ? value : undefined
}
