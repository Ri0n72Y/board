import { useEffect, useMemo, useRef, useState } from 'react'
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
import { exportCurrentBoard } from '../api/exports'
import type { ExportContextPackOptions } from '../hooks/useBoardExportController'
import { hasEffectiveFilters } from '../utils/board'
import type { BoardCurrentFilters } from '../utils/boardFilterUrl'
import { formatTagLabel } from '../utils/tagDisplay'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { MarkdownPreview } from './ui/MarkdownPreview'
import { Button } from './ui/Button'
import { Select } from './ui/Select'
import { SearchSelect } from './ui/SearchSelect'
import { SwitchField } from './ui/SwitchField'
import { TextInput } from './ui/TextInput'

function normalizeLanguage(lang: string): string {
  return lang === 'zh-CN' ? 'zh-CN' : 'en-US'
}

function profileI18nKey(profile: string, suffix: string): string {
  return `export.profiles.${profile}.${suffix}`
}

interface ExportContextDrawerProps {
  open: boolean
  records: RecordResponse<RecordItem<RecordBody>>[]
  filters: BoardCurrentFilters
  knownTags: Tag[]
  isExporting: boolean
  error: string | null
  onExport: (options: ExportContextPackOptions) => boolean
  onSaveDraft?: (
    options: ExportContextPackOptions & { title: string }
  ) => Promise<void>
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
  const lang = normalizeLanguage(i18n.language)
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
        label: t(profileI18nKey(definition.id, 'label'), definition.label),
      })),
    [t]
  )
  const profileDefinition = useMemo(
    () => getAgentContextProfileDefinition(profile),
    [profile]
  )

  const recordOptions = useMemo(
    () =>
      records.map((record) => ({
        value: record.body.id,
        label: `${record.body.pid} - ${titleFromBody(record.body.body) ?? record.body.pid}`,
        description: record.body.schema,
        meta: [
          record.body.assignee,
          record.body.tags.find((tag) => tag.startsWith('status:')),
        ]
          .filter(Boolean)
          .join(' / '),
      })),
    [records]
  )
  const sprintOptions = useMemo(
    () =>
      knownTags
        .filter((tag) => tag.startsWith('sprint:'))
        .sort((a, b) => a.localeCompare(b))
        .map((tag) => ({
          value: tag,
          label: formatTagLabel(tag, lang),
          meta: tag,
        })),
    [knownTags, lang]
  )

  const needsRecord = profileDefinition.requiresRecord
  const needsSprint = profileDefinition.requiresSprint

  // ── Stable clearPreview ──
  function clearPreview() {
    previewRequestIdRef.current += 1
    previewAbortRef.current?.abort()
    previewAbortRef.current = null
    setPreviewContent(null)
    setPreviewError(null)
    setIsPreviewLoading(false)
  }

  // ── Track preview inputs for staleness detection ──
  const previewInputKey = `${lang}|${profile}|${contextGoal}|${recordId}|${sprintTag}|${includeContent}|${includeAssets}|${includeRelations}|${includeDiagnostics}|${JSON.stringify(filters)}`
  const lastPreviewKeyRef = useRef<string | null>(null)

  // ── Abort on input change without triggering state updates ──
  useEffect(() => {
    previewRequestIdRef.current += 1
    previewAbortRef.current?.abort()
    previewAbortRef.current = null
    // If there was a preview and inputs changed, mark stale
    if (
      lastPreviewKeyRef.current !== null &&
      lastPreviewKeyRef.current !== previewInputKey
    ) {
      setPreviewContent(null)
      setPreviewError(null)
      setIsPreviewLoading(false)
      lastPreviewKeyRef.current = null
    }
  }, [previewInputKey])

  function handleProfileChange(nextProfile: AgentContextProfile) {
    const definition = getAgentContextProfileDefinition(nextProfile)
    setProfile(nextProfile)
    setIncludeContent(definition.defaultIncludeContent)
    setIncludeAssets(definition.defaultIncludeAssets)
    setIncludeRelations(definition.defaultIncludeRelations)
    setIncludeDiagnostics(definition.defaultIncludeDiagnostics)
    if (!definition.requiresRecord) setRecordId('')
    if (!definition.requiresSprint) setSprintTag('')
  }

  function handlePreview() {
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
        language: lang,
        contextGoal: contextGoal.trim() || undefined,
        recordId: recordId || undefined,
        sprintTag: sprintTag || undefined,
        filters: profileDefinition.usesCurrentFilters ? filters : undefined,
        includeDiagnostics,
        includeRelations,
        includeAssets,
        includeContent,
      },
      controller.signal
    )
      .then((data) => {
        if (
          previewRequestIdRef.current !== requestId ||
          controller.signal.aborted
        )
          return
        setPreviewContent(data.content)
        lastPreviewKeyRef.current = previewInputKey
      })
      .catch((caught: unknown) => {
        if (
          previewRequestIdRef.current !== requestId ||
          controller.signal.aborted ||
          axios.isCancel(caught)
        )
          return
        setPreviewError(
          caught instanceof Error ? caught.message : String(caught)
        )
      })
      .finally(() => {
        if (previewRequestIdRef.current !== requestId) return
        setIsPreviewLoading(false)
        previewAbortRef.current = null
      })
  }

  function handleExportClick() {
    clearPreview()
    onExport({
      profile,
      language: lang,
      contextGoal,
      recordId: recordId || undefined,
      sprintTag: sprintTag || undefined,
      includeContent,
      includeAssets,
      includeRelations,
      includeDiagnostics,
    })
  }

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
            {t(
              profileI18nKey(profile, 'description'),
              profileDefinition.description
            )}
          </p>
          <p className="text-xs text-slate-500">
            {t(
              profileI18nKey(profile, 'purpose'),
              profileDefinition.agentReadingPurpose
            )}
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
              <SearchSelect
                mode="option"
                label={t('export.record')}
                value={recordId || null}
                onChange={(next) => setRecordId(next ?? '')}
                options={recordOptions}
                placeholder={t('export.recordPlaceholder')}
              />
            )}
            {needsSprint && sprintOptions.length > 0 ? (
              <SearchSelect
                mode="tag"
                label={t('export.sprintTag')}
                value={sprintTag || null}
                onChange={(next) => setSprintTag(next ?? '')}
                options={sprintOptions}
                placeholder={t('export.sprintTagPlaceholder')}
              />
            ) : null}
            {needsSprint && sprintOptions.length === 0 ? (
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
                  language: lang,
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
              {isSavingDraft
                ? t('export.draftSaving')
                : t('export.draftSaveButton')}
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
