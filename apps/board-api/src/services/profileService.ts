import type {
  CreateProfileInput,
  Profile,
  PublicKey,
  UpdateProfileInput,
} from '@labour-board/shared'
import type { ProfileRepository } from '../repositories/profileRepository.js'

const SENSITIVE_KEYS = [
  'privateKey',
  'password',
  'secretKey',
  'seedPhrase',
]

const AVATAR_URL_RE =
  /^https?:\/\/.+/

export class ProfileValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfileValidationError'
  }
}

export class ProfileConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfileConflictError'
  }
}

export class ProfileService {
  private readonly repository: ProfileRepository

  constructor(repository: ProfileRepository) {
    this.repository = repository
  }

  async list(): Promise<Profile[]> {
    return this.repository.list()
  }

  async findByPk(pk: PublicKey): Promise<Profile | null> {
    return this.repository.findByPk(pk)
  }

  async create(input: CreateProfileInput): Promise<Profile> {
    // 1. validate raw shape
    assertCreateProfileShape(input)

    // 2. normalize
    const normalized = normalizeCreateProfileInput(input)

    // 3. validate normalized values
    assertNonEmptyPk(normalized.pk)
    assertNonEmptyName(normalized.name)
    assertValidAvatarUrl(normalized.avatarUrl)

    // 4. duplicate check with normalized pk
    const existing = await this.repository.findByPk(normalized.pk)
    if (existing) {
      throw new ProfileConflictError(`Profile already exists: ${normalized.pk}`)
    }

    // 5. create normalized
    return this.repository.create(normalized)
  }

  async update(
    pk: PublicKey,
    input: UpdateProfileInput,
  ): Promise<Profile | null> {
    const pathPk = pk.trim()

    // 1. validate raw shape
    assertUpdateProfileShape(input)

    // 2. normalize
    const normalized = normalizeUpdateProfileInput(input)

    // 3. body.pk must match path pk (both trimmed)
    if (
      normalized.pk !== undefined &&
      normalized.pk !== pathPk
    ) {
      throw new ProfileValidationError(
        'Body pk must match URL path pk',
      )
    }

    // 4. validate normalized values
    if (normalized.name !== undefined) {
      assertNonEmptyName(normalized.name)
    }
    if (normalized.avatarUrl !== undefined) {
      assertValidAvatarUrl(normalized.avatarUrl)
    }

    // 5. update with path pk
    return this.repository.update(pathPk, normalized)
  }
}

/* ─── Normalization ─── */

function normalizeCreateProfileInput(
  input: CreateProfileInput,
): CreateProfileInput {
  return {
    pk: input.pk.trim(),
    name: input.name.trim(),
    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
  }
}

function normalizeUpdateProfileInput(
  input: UpdateProfileInput,
): UpdateProfileInput {
  const normalized: UpdateProfileInput = {}
  if (input.pk !== undefined) {
    normalized.pk = input.pk.trim()
  }
  if (input.name !== undefined) {
    normalized.name = input.name.trim()
  }
  if (input.avatarUrl !== undefined) {
    normalized.avatarUrl = normalizeAvatarUrl(input.avatarUrl)
  }
  return normalized
}

function normalizeAvatarUrl(
  value: string | null | undefined,
): string | null | undefined {
  if (value === null || value === undefined) return value
  // Empty or whitespace-only → null
  if (value.trim().length === 0) return null
  return value.trim()
}

/* ─── Shape validation (no normalization) ─── */

function assertCreateProfileShape(input: CreateProfileInput): void {
  if (typeof input.pk !== 'string') {
    throw new ProfileValidationError('Profile pk must be a string')
  }
  if (typeof input.name !== 'string') {
    throw new ProfileValidationError('Profile name must be a string')
  }
  assertNoSensitiveKeys(input as unknown as Record<string, unknown>)
}

function assertUpdateProfileShape(input: UpdateProfileInput): void {
  if (input.name !== undefined && typeof input.name !== 'string') {
    throw new ProfileValidationError('Profile name must be a string')
  }
  assertNoSensitiveKeys(input as unknown as Record<string, unknown>)
}

/* ─── Normalized value validation ─── */

function assertNonEmptyPk(pk: string): void {
  if (!pk || typeof pk !== 'string' || pk.length === 0) {
    throw new ProfileValidationError('Profile pk is required')
  }
}

function assertNonEmptyName(name: string): void {
  if (typeof name !== 'string' || name.length === 0) {
    throw new ProfileValidationError(
      'Profile name is required and must not be empty',
    )
  }
}

function assertValidAvatarUrl(avatarUrl: string | null | undefined): void {
  if (avatarUrl === null || avatarUrl === undefined) return
  if (typeof avatarUrl !== 'string') {
    throw new ProfileValidationError('avatarUrl must be a string URL or null')
  }
  if (!AVATAR_URL_RE.test(avatarUrl)) {
    throw new ProfileValidationError(
      'avatarUrl must be an http or https URL',
    )
  }
}

function assertNoSensitiveKeys(input: Record<string, unknown>): void {
  for (const key of SENSITIVE_KEYS) {
    if (key in input) {
      throw new ProfileValidationError(
        `Field "${key}" is not accepted in profile input`,
      )
    }
  }
}
