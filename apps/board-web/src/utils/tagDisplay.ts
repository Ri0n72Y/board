import type { TFunction } from 'i18next'

/**
 * Matches known tag patterns: namespace:value
 * Used to identify whether a tag could have a display text translation.
 */
const TAG_PATTERN = /^([a-zA-Z][a-zA-Z0-9_-]*):(.+)$/

/**
 * Parse a tag string into namespace and value components.
 */
export function parseTag(raw: string): { namespace: string; value: string } | null {
  const match = TAG_PATTERN.exec(raw)
  if (!match) return null
  return { namespace: match[1], value: match[2] }
}

/**
 * Format a tag for display using i18next translations.
 *
 * Strategy:
 * 1. Try to translate the full tag key: `tags:{tag}` (e.g. `tags.status:todo`)
 * 2. If that key exists in the translation resources, return the translated value
 * 3. Otherwise, return the raw tag as-is (fallback for custom/user-defined tags)
 *
 * This ensures:
 * - Default tags show human-readable text in the current language
 * - Custom tags fall back to raw encoding (e.g. `status:my-custom-status`)
 * - API payloads always use raw tag IDs (no display text leakage)
 */
export function formatTagLabel(tag: string, t: TFunction): string {
  // Try full tag key translation (e.g. 'tags.status:todo')
  const key = `tags.${tag}`
  const translated = t(key)

  // If the translation key resolves to something different than the key itself,
  // it means we have a translation for this tag
  if (translated !== key) {
    return translated
  }

  // Fallback: return raw tag as-is
  return tag
}

/**
 * Check whether a tag has a known display text (i.e. has an i18n key defined).
 * Use this to distinguish default versus custom tags in UI logic.
 */
export function isDefaultTag(tag: string, t: TFunction): boolean {
  const key = `tags.${tag}`
  return t(key) !== key
}
