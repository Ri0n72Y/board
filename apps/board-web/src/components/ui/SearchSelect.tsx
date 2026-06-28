import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/20/solid'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import {
  addSearchSelectValue,
  canSelectSearchSelectChoice,
  filterSearchSelectOptions,
  getSearchSelectDisplayLabel,
  removeSearchSelectValue,
  type SearchSelectChoice,
  type SearchSelectMode,
  type SearchSelectOption,
} from '../../utils/searchSelect'

export type { SearchSelectMode, SearchSelectOption }

export interface SearchSelectProps {
  mode: SearchSelectMode
  label?: string
  placeholder?: string
  options: SearchSelectOption[]
  value?: string | null
  values?: string[]
  multiple?: boolean
  allowCustomValue?: boolean
  disabled?: boolean
  debounceMs?: number
  emptyText?: string
  selectedLabel?: string
  onChange?: (value: string | null) => void
  onChangeMany?: (values: string[]) => void
}

export function SearchSelect({
  mode,
  label,
  placeholder,
  options,
  value = null,
  values = [],
  multiple = false,
  allowCustomValue = false,
  disabled = false,
  debounceMs = 250,
  emptyText,
  selectedLabel,
  onChange,
  onChangeMany,
}: SearchSelectProps) {
  const { t, i18n } = useTranslation()
  const id = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const language = i18n.resolvedLanguage

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), debounceMs)
    return () => window.clearTimeout(timer)
  }, [debounceMs, query])

  const optionByValue = useMemo(() => {
    const map = new Map<string, SearchSelectOption>()
    for (const option of options) map.set(option.value, option)
    return map
  }, [options])

  const choices = useMemo(
    () =>
      filterSearchSelectOptions({
        mode,
        query: debouncedQuery,
        options,
        language,
        allowCustomValue,
      }),
    [allowCustomValue, debouncedQuery, language, mode, options]
  )

  const selectedValues = useMemo(
    () => (multiple ? values : value ? [value] : []),
    [multiple, value, values]
  )
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues])
  const visibleChoices = useMemo(
    () =>
      multiple
        ? choices.filter((choice) => !selectedSet.has(choice.value))
        : choices,
    [choices, multiple, selectedSet]
  )

  const clampedHighlight = Math.min(
    highlightedIndex,
    Math.max(visibleChoices.length - 1, 0)
  )
  const currentValue =
    !multiple && value
      ? getSearchSelectDisplayLabel(
          optionByValue.get(value),
          value,
          mode,
          language
        )
      : ''
  const inputValue = isOpen || multiple ? query : currentValue

  function open() {
    if (disabled) return
    setIsOpen(true)
  }

  function close() {
    setIsOpen(false)
    setQuery('')
    setDebouncedQuery('')
    setHighlightedIndex(0)
  }

  function commitChoice(choice: SearchSelectChoice | undefined) {
    if (!canSelectSearchSelectChoice(choice)) return
    if (multiple) {
      onChangeMany?.(addSearchSelectValue(values, choice.value))
      setQuery('')
      setDebouncedQuery('')
      setHighlightedIndex(0)
      setIsOpen(true)
      inputRef.current?.focus()
      return
    }
    onChange?.(choice.value)
    close()
  }

  function removeValue(nextValue: string) {
    if (multiple) {
      onChangeMany?.(removeSearchSelectValue(values, nextValue))
      return
    }
    onChange?.(null)
    close()
  }

  function clear() {
    if (multiple) {
      onChangeMany?.([])
      setQuery('')
      setDebouncedQuery('')
      return
    }
    onChange?.(null)
    close()
  }

  function moveHighlight(delta: number) {
    if (visibleChoices.length === 0) return
    setHighlightedIndex((current) => {
      const next = current + delta
      if (next < 0) return visibleChoices.length - 1
      if (next >= visibleChoices.length) return 0
      return next
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      open()
      moveHighlight(1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      open()
      moveHighlight(-1)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      open()
      commitChoice(visibleChoices[clampedHighlight] ?? visibleChoices[0])
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative grid w-full gap-1.5"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null))
          close()
      }}
    >
      {label && (
        <label className="text-xs font-bold text-slate-500" htmlFor={id}>
          {label}
        </label>
      )}

      {multiple && selectedValues.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          aria-label={selectedLabel ?? t('searchSelect.selected')}
        >
          {selectedValues.map((selectedValue) => (
            <button
              key={selectedValue}
              type="button"
              className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-full border border-emerald-700 bg-emerald-100 px-2.5 text-xs font-medium leading-tight text-emerald-800"
              onClick={() => removeValue(selectedValue)}
              disabled={disabled}
              title={t('searchSelect.remove')}
            >
              <span className="truncate">
                {getSearchSelectDisplayLabel(
                  optionByValue.get(selectedValue),
                  selectedValue,
                  mode,
                  language
                )}
              </span>
              <XMarkIcon className="h-3.5 w-3.5 shrink-0" />
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 pr-14 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          value={inputValue}
          onChange={(event) => {
            setQuery(event.target.value)
            open()
            setHighlightedIndex(0)
          }}
          onFocus={open}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t('searchSelect.searchPlaceholder')}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={`${id}-listbox`}
        />
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          {selectedValues.length > 0 && (
            <button
              type="button"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={clear}
              disabled={disabled}
              title={t('searchSelect.clear')}
              aria-label={t('searchSelect.clear')}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => (isOpen ? close() : open())}
            disabled={disabled}
            title={isOpen ? t('searchSelect.close') : t('searchSelect.open')}
            aria-label={
              isOpen ? t('searchSelect.close') : t('searchSelect.open')
            }
          >
            <ChevronDownIcon
              className={cn('h-4 w-4 transition', isOpen && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          id={`${id}-listbox`}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
          role="listbox"
        >
          {visibleChoices.length > 0 ? (
            visibleChoices.map((choice, index) => (
              <button
                key={`${choice.custom ? 'custom' : 'option'}:${choice.value}`}
                type="button"
                className={cn(
                  'grid w-full gap-0.5 px-3 py-2 text-left outline-none transition',
                  choice.disabled
                    ? 'cursor-not-allowed text-slate-300'
                    : 'text-slate-700 hover:bg-emerald-50 hover:text-slate-950',
                  index === clampedHighlight &&
                    !choice.disabled &&
                    'bg-emerald-50 text-slate-950'
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => commitChoice(choice)}
                disabled={choice.disabled}
                role="option"
                aria-selected={selectedSet.has(choice.value)}
              >
                {choice.custom ? (
                  <>
                    <span className="font-medium">
                      {t('searchSelect.useCustomValue')}
                    </span>
                    <span className="break-all font-mono text-xs text-slate-500">
                      {choice.value}
                    </span>
                  </>
                ) : (
                  <OptionLine choice={choice} mode={mode} language={language} />
                )}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-slate-500">
              {emptyText ??
                t(
                  options.length === 0
                    ? 'searchSelect.noOptions'
                    : 'searchSelect.empty'
                )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function OptionLine({
  choice,
  mode,
  language,
}: {
  choice: SearchSelectChoice
  mode: SearchSelectMode
  language?: string
}) {
  const label = getSearchSelectDisplayLabel(
    choice,
    choice.value,
    mode,
    language
  )
  const meta =
    mode === 'tag'
      ? choice.value !== label
        ? choice.value
        : choice.meta
      : choice.meta

  return (
    <span className="flex min-w-0 items-center gap-2">
      {choice.avatarUrl ? (
        <img
          src={choice.avatarUrl}
          alt=""
          className="h-6 w-6 shrink-0 rounded-full object-cover"
        />
      ) : choice.avatarInitials ? (
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
          {choice.avatarInitials}
        </span>
      ) : null}
      <span className="grid min-w-0 gap-0.5">
        <span
          className={cn('truncate font-medium', mode === 'tag' && 'font-sans')}
        >
          {label}
        </span>
        {choice.description && (
          <span className="truncate text-xs text-slate-500">
            {choice.description}
          </span>
        )}
        {meta && (
          <span className="break-all font-mono text-xs text-slate-400">
            {meta}
          </span>
        )}
      </span>
    </span>
  )
}
