import type {
  CreateProfileInput,
  Profile,
  PublicKey,
  UpdateProfileInput,
} from '@labour-board/shared'
import type { ProfileRepository } from '../repositories/profileRepository.js'

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
    assertProfileInput(input)

    const existing = await this.repository.findByPk(input.pk)
    if (existing) {
      throw new ProfileConflictError(`Profile already exists: ${input.pk}`)
    }

    return this.repository.create(input)
  }

  async update(
    pk: PublicKey,
    input: UpdateProfileInput
  ): Promise<Profile | null> {
    assertProfileUpdateInput(input)
    return this.repository.update(pk, input)
  }
}

function assertProfileInput(input: CreateProfileInput): void {
  if (!input.pk || typeof input.pk !== 'string') {
    throw new ProfileValidationError('Profile pk is required')
  }

  if (!input.name || typeof input.name !== 'string') {
    throw new ProfileValidationError('Profile name is required')
  }
}

function assertProfileUpdateInput(input: UpdateProfileInput): void {
  if (input.name !== undefined && input.name.trim() === '') {
    throw new ProfileValidationError('Profile name cannot be empty')
  }
}
