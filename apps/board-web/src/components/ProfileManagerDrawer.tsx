import { useCallback, useId, useMemo, useState } from 'react'
import type { Profile } from '@labour-board/shared'
import {
  CheckIcon,
  ClipboardDocumentIcon,
  PencilSquareIcon,
  PlusIcon,
} from '@heroicons/react/20/solid'
import { useTranslation } from 'react-i18next'
import { AnimatedDrawer } from './ui/AnimatedDrawer'
import { Button } from './ui/Button'
import { TextInput } from './ui/TextInput'
import { shortPublicKey } from '../utils/profileDisplay'
import { useBoardMetadataStore } from '../stores/boardMetadataStore'
import { ProfileAvatar } from './ProfileAvatar'
import { cn } from '../lib/cn'

interface ProfileManagerDrawerProps {
  open: boolean
  onClose: () => void
}

type FormMode = 'idle' | 'create' | 'edit'

interface FormState {
  pk: string
  name: string
  avatarUrl: string
}

function emptyForm(): FormState {
  return { pk: '', name: '', avatarUrl: '' }
}

function editForm(profile: Profile): FormState {
  return {
    pk: profile.pk,
    name: profile.name,
    avatarUrl: profile.avatarUrl ?? '',
  }
}

export function ProfileManagerDrawer({
  open,
  onClose,
}: ProfileManagerDrawerProps) {
  const { t } = useTranslation()
  const profiles = useBoardMetadataStore((s) => s.profiles)
  const createProfile = useBoardMetadataStore((s) => s.createProfile)
  const updateProfile = useBoardMetadataStore((s) => s.updateProfile)

  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<FormMode>('idle')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedPk, setCopiedPk] = useState<string | null>(null)

  const filteredProfiles = useMemo(() => {
    if (!profiles) return []
    const q = search.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter(
      (p) => p.name.toLowerCase().includes(q) || p.pk.toLowerCase().includes(q)
    )
  }, [profiles, search])

  const closeForm = useCallback(() => {
    setMode('idle')
    setForm(emptyForm)
    setError(null)
  }, [])

  const openCreate = useCallback(() => {
    setMode('create')
    setForm(emptyForm())
    setError(null)
  }, [])

  const openEdit = useCallback((profile: Profile) => {
    setMode('edit')
    setForm(editForm(profile))
    setError(null)
  }, [])

  async function submitCreate() {
    const name = form.name.trim()
    const pk = form.pk.trim()
    const avatarUrl = form.avatarUrl.trim()

    if (!pk) {
      setError(t('profileManager.errorPkRequired'))
      return
    }
    if (!name) {
      setError(t('profileManager.errorNameRequired'))
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await createProfile({
        pk,
        name,
        avatarUrl: avatarUrl || undefined,
      })
      closeForm()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t('profileManager.errorGeneral')
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitEdit() {
    const name = form.name.trim()
    const pk = form.pk
    const avatarUrl = form.avatarUrl.trim()

    if (!name) {
      setError(t('profileManager.errorNameRequired'))
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await updateProfile(pk, {
        name,
        avatarUrl: avatarUrl || null,
      })
      closeForm()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t('profileManager.errorGeneral')
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function copyPk(pk: string) {
    try {
      await navigator.clipboard.writeText(pk)
      setCopiedPk(pk)
      setTimeout(() => setCopiedPk(null), 2000)
    } catch {
      // clipboard API not available
    }
  }

  return (
    <AnimatedDrawer
      open={open}
      onClose={onClose}
      title={t('profileManager.title')}
      subtitle={t('profileManager.subtitle')}
      size="md"
      closeLabel={t('profileManager.close')}
    >
      <div className="grid gap-4">
        {/* Search + Create */}
        <div className="flex items-center gap-2">
          <TextInput
            label=""
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('profileManager.searchPlaceholder')}
          />
          <Button
            type="button"
            className="shrink-0 self-end"
            onClick={openCreate}
            icon={<PlusIcon className="h-4 w-4" />}
          >
            {t('profileManager.create')}
          </Button>
        </div>

        {/* Create/Edit form */}
        {mode !== 'idle' && (
          <ProfileManagerFormCard
            mode={mode}
            form={form}
            error={error}
            isSubmitting={isSubmitting}
            onChangePk={(pk) => setForm((f) => ({ ...f, pk }))}
            onChangeName={(name) => setForm((f) => ({ ...f, name }))}
            onChangeAvatarUrl={(avatarUrl) =>
              setForm((f) => ({ ...f, avatarUrl }))
            }
            onSubmit={mode === 'create' ? submitCreate : submitEdit}
            onCancel={closeForm}
            t={t}
          />
        )}

        {/* Profile list */}
        {profiles === null ? (
          <p className="text-sm text-slate-500">
            {t('profileManager.loading')}
          </p>
        ) : filteredProfiles.length === 0 ? (
          <p className="text-sm text-slate-500">
            {search.trim()
              ? t('profileManager.noResults')
              : t('profileManager.empty')}
          </p>
        ) : (
          <ul className="grid gap-2">
            {filteredProfiles.map((profile) => (
              <ProfileManagerProfileItem
                key={profile.pk}
                profile={profile}
                copiedPk={copiedPk}
                onEdit={() => openEdit(profile)}
                onCopyPk={() => copyPk(profile.pk)}
                t={t}
              />
            ))}
          </ul>
        )}
      </div>
    </AnimatedDrawer>
  )
}

/* ─── Profile list item ─── */

function ProfileManagerProfileItem({
  profile,
  copiedPk,
  onEdit,
  onCopyPk,
  t,
}: {
  profile: Profile
  copiedPk: string | null
  onEdit: () => void
  onCopyPk: () => void
  t: (key: string) => string
}) {
  const justCopied = copiedPk === profile.pk

  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      {/* Avatar */}
      <ProfileAvatar
        name={profile.name}
        pk={profile.pk}
        avatarUrl={profile.avatarUrl}
      />

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {profile.name}
        </p>
        <p className="truncate font-mono text-xs text-slate-500">
          {shortPublicKey(profile.pk)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          className="min-h-8 px-2 text-xs"
          onClick={onCopyPk}
          title={t('profileManager.copyPk')}
          icon={
            justCopied ? (
              <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <ClipboardDocumentIcon className="h-3.5 w-3.5" />
            )
          }
        >
          {justCopied ? t('profileManager.copied') : t('profileManager.copyPk')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-8 px-2 text-xs"
          onClick={onEdit}
          title={t('profileManager.edit')}
          icon={<PencilSquareIcon className="h-3.5 w-3.5" />}
        >
          {t('profileManager.edit')}
        </Button>
      </div>
    </li>
  )
}

/* ─── Create / Edit form card ─── */

function ProfileManagerFormCard({
  mode,
  form,
  error,
  isSubmitting,
  onChangePk,
  onChangeName,
  onChangeAvatarUrl,
  onSubmit,
  onCancel,
  t,
}: {
  mode: FormMode
  form: FormState
  error: string | null
  isSubmitting: boolean
  onChangePk: (value: string) => void
  onChangeName: (value: string) => void
  onChangeAvatarUrl: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  t: (key: string) => string
}) {
  const pkId = useId()
  const nameId = useId()
  const avatarUrlId = useId()
  const isCreate = mode === 'create'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4"
    >
      <h3 className="text-sm font-semibold text-slate-700">
        {isCreate
          ? t('profileManager.createTitle')
          : t('profileManager.editTitle')}
      </h3>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      )}

      {/* PK */}
      <div className="grid gap-1.5">
        <label htmlFor={pkId} className="text-xs font-bold text-slate-500">
          {t('profileManager.pk')}
        </label>
        {isCreate ? (
          <input
            id={pkId}
            className="min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-mono text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            value={form.pk}
            onChange={(e) => onChangePk(e.target.value)}
            placeholder={t('profileManager.pkPlaceholder')}
            disabled={isSubmitting}
            required
          />
        ) : (
          <div className="min-h-10 rounded-md border border-slate-200 bg-slate-100 px-3 py-2.5 font-mono text-sm text-slate-600">
            {form.pk}
          </div>
        )}
      </div>

      {/* Name */}
      <div className="grid gap-1.5">
        <label htmlFor={nameId} className="text-xs font-bold text-slate-500">
          {t('profileManager.name')}
        </label>
        <input
          id={nameId}
          className={cn(
            'min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50'
          )}
          value={form.name}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder={t('profileManager.namePlaceholder')}
          disabled={isSubmitting}
          required
        />
      </div>

      {/* Avatar URL */}
      <div className="grid gap-1.5">
        <label
          htmlFor={avatarUrlId}
          className="text-xs font-bold text-slate-500"
        >
          {t('profileManager.avatarUrl')}
        </label>
        <input
          id={avatarUrlId}
          className={cn(
            'min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50'
          )}
          value={form.avatarUrl}
          onChange={(e) => onChangeAvatarUrl(e.target.value)}
          placeholder={t('profileManager.avatarUrlPlaceholder')}
          disabled={isSubmitting}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {t('profileManager.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          icon={
            isSubmitting ? undefined : isCreate ? (
              <PlusIcon className="h-4 w-4" />
            ) : (
              <CheckIcon className="h-4 w-4" />
            )
          }
        >
          {isSubmitting
            ? t('profileManager.saving')
            : isCreate
              ? t('profileManager.createButton')
              : t('profileManager.saveButton')}
        </Button>
      </div>
    </form>
  )
}
