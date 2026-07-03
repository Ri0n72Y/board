/**
 * Tag display formatter.
 *
 * Uses standalone label dictionaries (tagLabels.en-US.ts / tagLabels.zh-CN.ts)
 * instead of i18next. This separates tag domain i18n from UI i18n.
 */

import { enUSTagLabels } from '../i18n/tagLabels.en-US'
import { zhCNTagLabels } from '../i18n/tagLabels.zh-CN'

/* ─── Types ─── */

export type TagLabelNamespace =
  | 'status'
  | 'priority'
  | 'transaction'
  | 'epic'
  | 'sprint'
  | 'owner'
  | 'scope'
  | 'type'
  | 'milestone'
  | 'asset'

const KNOWN_NAMESPACES: readonly string[] = [
  'status',
  'priority',
  'transaction',
  'epic',
  'sprint',
  'owner',
  'scope',
  'type',
  'milestone',
  'asset',
]

export type TagLabelDictionary = Partial<
  Record<TagLabelNamespace, Record<string, string>>
>

export type TagDisplayLanguage = 'en-US' | 'zh-CN'

export interface ParsedTag {
  raw: string
  namespace?: TagLabelNamespace
  value: string
  canonical: boolean
}

/* ─── Dictionary lookup ─── */

const DICTIONARIES: Record<TagDisplayLanguage, TagLabelDictionary> = {
  'en-US': enUSTagLabels,
  'zh-CN': zhCNTagLabels,
}

export function normalizeTagLanguage(
  language: string | undefined
): TagDisplayLanguage {
  if (language === 'zh-CN') return 'zh-CN'
  return 'en-US'
}

/* ─── Parse ─── */

const TAG_RE = /^([a-zA-Z][a-zA-Z0-9_-]*):(.+)$/

export function parseTag(raw: string): ParsedTag {
  const match = TAG_RE.exec(raw)
  if (!match) {
    return { raw, value: raw, canonical: false }
  }
  const ns = match[1]
  const value = match[2]
  if ((KNOWN_NAMESPACES as readonly string[]).includes(ns)) {
    return { raw, namespace: ns as TagLabelNamespace, value, canonical: true }
  }
  return { raw, value, canonical: true }
}

/* ─── Format ─── */

function lookup(
  namespace: TagLabelNamespace,
  value: string,
  lang: TagDisplayLanguage
): string | undefined {
  return DICTIONARIES[lang]?.[namespace]?.[value] ?? undefined
}

/**
 * Format a tag for display.
 *
 * @param raw       Raw tag string (e.g. `status:doing` or bare `doing`)
 * @param language  UI language, e.g. `zh-CN` or `en-US`
 * @param options.namespace  Hint when `raw` is a bare value without prefix
 */
export function formatTagLabel(
  raw: string,
  language: string | undefined,
  options?: { namespace?: TagLabelNamespace }
): string {
  const lang = normalizeTagLanguage(language)
  const hintNs = options?.namespace

  // 1. Parse the tag
  const parsed = parseTag(raw)

  // 2. Canonical: lookup by namespace + value
  if (parsed.canonical && parsed.namespace) {
    const found = lookup(parsed.namespace, parsed.value, lang)
    if (found) return found
    // If namespace is known but value has no translation, return raw
    return raw
  }

  // 3. Bare tag with explicit namespace hint
  if (hintNs) {
    const found = lookup(hintNs, parsed.value, lang)
    if (found) return found
  }

  // 4. Bare tag without namespace
  //    If it looks numeric, wrap it to avoid showing raw "1"
  if (/^\d+$/.test(parsed.value)) {
    return lang === 'zh-CN' ? `其他：${parsed.value}` : `Other: ${parsed.value}`
  }

  // 5. Last resort: raw value
  return raw
}

/**
 * Format a tag's title/tooltip — always the raw tag id.
 */
export function formatTagTitle(raw: string): string {
  return raw
}
