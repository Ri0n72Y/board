/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import { avatarColor, profileInitials } from '../utils/profileDisplay'

interface ProfileAvatarProps {
  name: string
  pk: string
  avatarUrl?: string | null
  size?: number
  className?: string
}

/**
 * Renders a profile avatar.
 * - If avatarUrl is set and loads successfully, shows the image.
 * - On img load error, falls back to initials with deterministic background color.
 * - If no avatarUrl, shows initials immediately.
 */
export function ProfileAvatar({
  name,
  pk,
  avatarUrl,
  size = 40,
  className = '',
}: ProfileAvatarProps) {
  const [hasImgError, setHasImgError] = useState(false)

  // Reset error state when avatarUrl changes so a new URL retries loading
  useEffect(() => {
    setHasImgError(false)
  }, [avatarUrl])

  const showImg = avatarUrl && !hasImgError
  const initials = profileInitials(name, pk)
  const color = avatarColor(pk)

  if (showImg) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
        onError={() => setHasImgError(true)}
      />
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: Math.max(10, size * 0.35),
      }}
      title={name}
    >
      {initials}
    </div>
  )
}
