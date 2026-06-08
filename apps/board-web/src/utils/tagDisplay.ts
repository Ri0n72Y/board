import type { TFunction } from 'i18next'

/**
 * Known tag namespace categories used for display inference.
 */
export type TagDisplayNamespace =
  | 'status'
  | 'priority'
  | 'transaction'
  | 'asset'
  | 'epic'
  | 'sprint'
  | 'owner'
  | 'scope'
  | 'type'
  | 'milestone'

/**
 * The set of namespaces whose tag keys follow the pattern `namespace:value`.
 */
const KNOWN_NAMESPACES: readonly TagDisplayNamespace[] = [
  'status',
  'priority',
  'transaction',
  'asset',
  'epic',
  'sprint',
  'owner',
  'scope',
  'type',
  'milestone',
]

/** Regex matching canonical tag format: namespace:value */
const TAG_PATTERN = /^([a-zA-Z][a-zA-Z0-9_-]*):(.+)$/

/** ─── Parse ─── */

export interface ParsedTag {
  raw: string
  namespace: string
  value: string
}

export function parseTag(raw: string): ParsedTag | null {
  const match = TAG_PATTERN.exec(raw)
  if (!match) return null
  return { raw, namespace: match[1], value: match[2] }
}

/** ─── Display helpers ─── */

export interface TagDisplayInput {
  raw: string
  namespace?: TagDisplayNamespace
}

/**
 * Format a tag for display using i18next translations.
 *
 * Strategy (in order):
 * 1. If raw is canonical `namespace:value`, look up `tags.namespace:value`
 * 2. If a namespace hint is provided, also try `tags.{namespace}:{raw}` (for bare values)
 * 3. Fall back to raw tag string
 */
export function formatTagLabel(
  input: string | TagDisplayInput,
  t: TFunction,
): string {
  const raw = typeof input === 'string' ? input : input.raw
  const hintNs = typeof input === 'string' ? undefined : input.namespace

  // 1. Try canonical key: `tags.{raw}` (e.g. `tags.status:todo`)
  const canonicalKey = `tags.${raw}`
  const canonicalResult = t(canonicalKey)
  if (canonicalResult !== canonicalKey) return canonicalResult

  // 2. If namespace hint provided and raw is bare, try `tags.{hintNs}:{raw}`
  if (hintNs && !raw.includes(':')) {
    const hintedKey = `tags.${hintNs}:${raw}`
    const hintedResult = t(hintedKey)
    if (hintedResult !== hintedKey) return hintedResult
  }

  // 3. If raw is canonical but no translation found, try to construct a readable label
  const parsed = parseTag(raw)
  if (parsed) {
    // Try with just the value part and namespace hint
    const nsKey = `tags.${parsed.namespace}:${parsed.value}`
    const nsResult = t(nsKey)
    if (nsResult !== nsKey) return nsResult
  }

  // 4. Fallback: raw
  return raw
}

/**
 * Format a tag with a known namespace.
 *
 * Use when the caller knows the namespace context (e.g. BoardView status columns,
 * BoardFilters status/priority options).
 */
export function formatTagLabelWithNamespace(
  raw: string,
  namespace: TagDisplayNamespace,
  t: TFunction,
): string {
  // Try canonical `tags.{namespace}:{raw}`
  const canonicalKey = `tags.${namespace}:${raw}`
  const canonicalResult = t(canonicalKey)
  if (canonicalResult !== canonicalKey) return canonicalResult

  // If raw is already namespace:value, try full key
  if (raw.includes(':')) {
    const fullKey = `tags.${raw}`
    const fullResult = t(fullKey)
    if (fullResult !== fullKey) return fullResult
  }

  return raw
}

/**
 * Try to infer the tag namespace from known defaults.
 * Returns null if no unique namespace can be inferred.
 */
export function inferDefaultTagNamespace(raw: string): TagDisplayNamespace | null {
  // If raw is canonical, extract namespace
  const parsed = parseTag(raw)
  if (parsed && (KNOWN_NAMESPACES as readonly string[]).includes(parsed.namespace)) {
    return parsed.namespace as TagDisplayNamespace
  }

  // Cannot infer bare value namespace reliably
  return null
}

/**
 * Check if a tag has a known i18n translation.
 */
export function isDefaultTag(raw: string, t: TFunction): boolean {
  const key = `tags.${raw}`
  return t(key) !== key
}
