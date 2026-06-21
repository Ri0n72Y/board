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
  'secret',
  'key',
  'passphrase',
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
    assertCreateProfileInput(input)

    const existing = await this.repository.findByPk(input.pk)
    if (existing) {
      throw new ProfileConflictError(`Profile already exists: ${input.pk}`)
    }

    return this.repository.create(input)
  }

  async update(
    pk: PublicKey,
    input: UpdateProfileInput,
  ): Promise<Profile | null> {
    assertUpdateProfileInput(pk, input)
    return this.repository.update(pk, input)
  }
}

function assertCreateProfileInput(input: CreateProfileInput): void {
  assertNonEmptyPk(input.pk)
  assertNonEmptyName(input.name)
  assertNoSensitiveKeys(input as unknown as Record<string, unknown>)
  assertValidAvatarUrl(input.avatarUrl)
}

function assertUpdateProfileInput(
  pk: string,
  input: UpdateProfileInput,
): void {
  // Reject body.pk that mismatches path pk
  if (input.pk !== undefined && input.pk !== pk) {
    throw new ProfileValidationError(
      'Body pk must match URL path pk',
    )
  }

  if (input.name !== undefined) {
    assertNonEmptyName(input.name)
  }
  assertNoSensitiveKeys(input as unknown as Record<string, unknown>)
  if (input.avatarUrl !== undefined) {
    assertValidAvatarUrl(input.avatarUrl)
  }
}

function assertNonEmptyPk(pk: string): void {
  if (!pk || typeof pk !== 'string' || pk.trim().length === 0) {
    throw new ProfileValidationError('Profile pk is required')
  }
}

function assertNonEmptyName(name: string): void {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ProfileValidationError('Profile name is required and must not be empty')
  }
}

function assertValidAvatarUrl(avatarUrl: string | null | undefined): void {
  if (avatarUrl === null || avatarUrl === undefined || avatarUrl === '') {
    return
  }
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
