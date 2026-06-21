import type { Profile } from '@labour-board/shared'

/**
 * Compute 2-letter initials from a profile name.
 * - Two words: first letter of first two words ("Ada Lovelace" → "AL")
 * - One word: first letter of that word ("Marx" → "M")
 * - Trimmed lowercase words handled ("  li dazhao  " → "LD")
 * - Empty/invalid name: fallback to first 2 chars of pk uppercase
 */
export function profileInitials(
  name: string | undefined | null,
  pk: string | undefined | null,
): string {
  if (name && name.trim().length > 0) {
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase()
    }
    if (words.length === 1) {
      return words[0][0].toUpperCase()
    }
  }

  // Fallback to pk first 2 chars
  const source = pk?.trim() ?? ''
  if (source.length >= 2) {
    return source.slice(0, 2).toUpperCase()
  }
  if (source.length === 1) {
    return source.toUpperCase()
  }
  return '??'
}

/**
 * Truncate a public key for compact display.
 * Shows first 6 and last 4 characters: "abc123...xyz9"
 */
export function shortPublicKey(
  pk: string | undefined | null,
  maxLen = 6,
  tailLen = 4,
): string {
  if (!pk) return ''
  const trimmed = pk.trim()
  if (trimmed.length <= maxLen + tailLen + 3) return trimmed
  return `${trimmed.slice(0, maxLen)}...${trimmed.slice(-tailLen)}`
}

/**
 * Generate a deterministic hex color from a public key.
 * Same pk always returns the same color.
 * Returns a color suitable for avatar background (medium saturation, medium lightness).
 */
export function avatarColor(pk: string | undefined | null): string {
  const source = pk ?? ''
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) & 0xffffffff
  }
  // Use HSL with fixed saturation/lightness for readability
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 50%, 65%)`
}

/**
 * Build a search-select-friendly option from a profile.
 * Label: name
 * Description: short pk
 * Meta: full pk
 * Value: pk
 */
export function profileToOption(profile: Profile): {
  value: string
  label: string
  description: string
  meta: string
} {
  return {
    value: profile.pk,
    label: profile.name,
    description: shortPublicKey(profile.pk),
    meta: profile.pk,
  }
}

/**
 * Format assignee display for cards, history, etc.
 * Known profile: "Name (shortPk)"
 * Unknown pk: "Unknown member (shortPk)"
 * Empty: "Unassigned"
 */
export function formatAssigneeDisplay(
  pk: string | undefined | null,
  profile: Profile | undefined | null,
  unassignedLabel: string,
  unknownLabel: string,
): string {
  if (!pk || pk.trim() === '') return unassignedLabel
  const shortPk = shortPublicKey(pk)
  if (profile) {
    return `${profile.name} (${shortPk})`
  }
  return `${unknownLabel} (${shortPk})`
}

/**
 * Get option label for displaying a profile in search select display.
 * For unknown pk: "Unknown member" with description as short pk.
 */
export function profileOptionLabel(
  pk: string,
  profiles: Profile[] | null,
): string {
  if (!profiles) return shortPublicKey(pk) || pk
  const profile = profiles.find((p) => p.pk === pk)
  return profile ? profile.name : `Unknown member`
}

/**
 * Build profile SearchSelect options from profile list.
 */
export function buildProfileOptions(
  profiles: Profile[] | null,
): { value: string; label: string; description: string; meta: string }[] {
  if (!profiles) return []
  return profiles.map(profileToOption)
}
