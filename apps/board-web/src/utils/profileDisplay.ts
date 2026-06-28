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
 * Format display text for a profile: <nickname>#<pk first 8 chars>.
 * Unknown profile: <unknownLabel>#<pk first 8 chars>.
 * Empty pk: <unassignedLabel>.
 */
export function formatProfileCompact(
  pk: string | undefined | null,
  profile: Profile | undefined | null,
  unassignedLabel: string,
  unknownLabel: string,
): string {
  if (!pk || pk.trim() === '') return unassignedLabel
  const shortPk = pk.slice(0, 8)
  if (profile) {
    return `${profile.name}#${shortPk}`
  }
  return `${unknownLabel}#${shortPk}`
}

/**
 * Build profile SearchSelect options from profile list.
 * Label uses compact format: "<name>#<shortPk>".
 */
export function buildProfileOptions(
  profiles: Profile[] | null,
): {
  value: string
  label: string
  description: string
  meta: string
  avatarUrl?: string | null
  avatarInitials?: string
}[] {
  if (!profiles) return []
  return profiles.map((p) => ({
    value: p.pk,
    label: `${p.name}#${p.pk.slice(0, 8)}`,
    description: p.pk,
    meta: p.pk,
    avatarUrl: p.avatarUrl ?? null,
    avatarInitials: profileInitials(p.name, p.pk),
  }))
}
