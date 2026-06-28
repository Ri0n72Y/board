import { formatTagLabel } from './tagDisplay'

export type SearchSelectMode = 'tag' | 'option'

export interface SearchSelectOption {
  value: string
  label: string
  description?: string
  meta?: string
  disabled?: boolean
  avatarUrl?: string | null
  avatarInitials?: string
}

export interface SearchSelectFilterOptions {
  mode: SearchSelectMode
  query: string
  options: SearchSelectOption[]
  language?: string
  allowCustomValue?: boolean
}

export interface SearchSelectChoice extends SearchSelectOption {
  custom?: boolean
}

export function filterSearchSelectOptions({
  mode,
  query,
  options,
  language,
  allowCustomValue = false,
}: SearchSelectFilterOptions): SearchSelectChoice[] {
  const normalizedQuery = normalizeSearchText(query)
  const matched =
    normalizedQuery.length === 0
      ? options
      : options.filter((option) =>
          getSearchTokens(option, mode, language).some((token) =>
            normalizeSearchText(token).includes(normalizedQuery),
          ),
        )

  if (!allowCustomValue || !query.trim()) return matched

  const customValue = query.trim()
  const normalizedCustomValue = normalizeSearchText(customValue)
  const hasExactValueOrLabel = options.some(
    (option) =>
      normalizeSearchText(option.value) === normalizedCustomValue ||
      normalizeSearchText(option.label) === normalizedCustomValue,
  )
  if (hasExactValueOrLabel) return matched

  const customOption: SearchSelectChoice = {
    value: customValue,
    label: customValue,
    meta: customValue,
    custom: true,
  }

  if (matched.length > 0) return [...matched, customOption]

  return [
    customOption,
  ]
}

export function getSearchSelectDisplayLabel(
  option: SearchSelectOption | undefined,
  value: string,
  mode: SearchSelectMode,
  language?: string,
): string {
  if (mode === 'tag') return formatTagLabel(value, language)
  return option?.label ?? value
}

export function addSearchSelectValue(
  current: readonly string[],
  value: string,
): string[] {
  if (current.includes(value)) return [...current]
  return [...current, value]
}

export function removeSearchSelectValue(
  current: readonly string[],
  value: string,
): string[] {
  return current.filter((item) => item !== value)
}

export function canSelectSearchSelectChoice(
  choice: SearchSelectChoice | undefined,
): choice is SearchSelectChoice {
  return Boolean(choice && !choice.disabled)
}

function getSearchTokens(
  option: SearchSelectOption,
  mode: SearchSelectMode,
  language?: string,
): string[] {
  const tokens = [
    option.value,
    option.label,
    option.description ?? '',
    option.meta ?? '',
  ]
  if (mode === 'tag') tokens.push(formatTagLabel(option.value, language))
  return tokens
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase()
}
