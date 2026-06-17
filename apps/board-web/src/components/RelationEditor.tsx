import type { RelationRef } from '@labour-board/shared'
import {
  ExclamationTriangleIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/20/solid'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  formatRelationTarget,
  hasDuplicateRelations,
  hasSelfRelation,
  type RelationConstraintOption,
} from '../utils/relationDisplay'
import type { RecordReferenceOption } from '../utils/recordReferenceOptions'
import { Button } from './ui/Button'
import { SearchSelect } from './ui/SearchSelect'
import { Select } from './ui/Select'
import { TextInput } from './ui/TextInput'

export type RelationEditorProps = {
  label: string
  value: RelationRef[]
  targetOptions: RecordReferenceOption[]
  constraintOptions: RelationConstraintOption[]
  currentRecordId?: string
  disabled?: boolean
  onChange: (relations: RelationRef[]) => void
}

export function RelationEditor({
  label,
  value,
  targetOptions,
  constraintOptions,
  currentRecordId,
  disabled = false,
  onChange,
}: RelationEditorProps) {
  const { t } = useTranslation()
  const hasDuplicate = hasDuplicateRelations(value)
  const hasSelf = hasSelfRelation(value, currentRecordId)
  const availableTargets = useMemo(
    () =>
      currentRecordId
        ? targetOptions.filter((option) => option.value !== currentRecordId)
        : targetOptions,
    [currentRecordId, targetOptions],
  )

  function update(index: number, relation: RelationRef) {
    onChange(value.map((current, currentIndex) => (currentIndex === index ? relation : current)))
  }

  function remove(index: number) {
    onChange(value.filter((_, currentIndex) => currentIndex !== index))
  }

  function addRelation() {
    onChange([
      ...value,
      {
        constraint: constraintOptions[0]?.value ?? '',
        target: '',
      },
    ])
  }

  return (
    <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-500">{label}</h3>
        <Button
          type="button"
          variant="ghost"
          className="min-h-8 px-2.5 text-xs"
          onClick={addRelation}
          disabled={disabled || constraintOptions.length === 0 || targetOptions.length === 0}
          icon={<PlusIcon className="h-4 w-4" />}
        >
          {t('relations.add')}
        </Button>
      </div>

      {targetOptions.length === 0 && (
        <p className="text-sm text-slate-500">{t('relations.noTargetOptions')}</p>
      )}

      {hasSelf && (
        <InlineWarning>{t('relations.selfWarning')}</InlineWarning>
      )}

      {hasDuplicate && (
        <InlineWarning>{t('relations.duplicateWarning')}</InlineWarning>
      )}

      {value.length > 0 ? (
        <div className="grid gap-3">
          {value.map((relation, index) => {
            const isExistingSelf = Boolean(
              currentRecordId && relation.target.trim() === currentRecordId,
            )
            const rowTargets = isExistingSelf
              ? targetOptions
              : availableTargets
            const targetTitle = relation.target
              ? formatRelationTarget(relation.target, targetOptions)
              : undefined

            return (
              <div
                className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3"
                key={`${index}:${relation.constraint}:${relation.target}`}
              >
                <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-start">
                  <Select
                    label={t('relations.constraint')}
                    value={relation.constraint}
                    options={constraintOptions}
                    onChange={(event) =>
                      update(index, {
                        ...relation,
                        constraint: event.target.value,
                      })
                    }
                    disabled={disabled}
                  />
                  <SearchSelect
                    mode="option"
                    label={t('relations.target')}
                    value={relation.target || null}
                    options={rowTargets}
                    onChange={(target) =>
                      update(index, {
                        ...relation,
                        target: target ?? '',
                      })
                    }
                    placeholder={t('filters.relationTargetPlaceholder')}
                    emptyText={t('relations.noTargetOptions')}
                    allowCustomValue={false}
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-5 min-h-10 px-2.5"
                    onClick={() => remove(index)}
                    disabled={disabled}
                    title={t('relations.remove')}
                    icon={<TrashIcon className="h-4 w-4" />}
                  >
                    <span className="sr-only">{t('relations.remove')}</span>
                  </Button>
                </div>
                <TextInput
                  label={t('relations.description')}
                  value={relation.description ?? ''}
                  placeholder={t('relations.descriptionPlaceholder')}
                  onChange={(event) =>
                    update(index, {
                      ...relation,
                      description: event.target.value,
                    })
                  }
                  disabled={disabled}
                />
                {targetTitle && (
                  <p className="break-all text-xs text-slate-500" title={relation.target}>
                    {targetTitle}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500">{t('relations.none')}</p>
      )}
    </section>
  )
}

function InlineWarning({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
