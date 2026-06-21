import type { Collection, Document, OptionalId } from 'mongodb'
import type {
  CreateProfileInput,
  Profile,
  PublicKey,
  UpdateProfileInput,
} from '@labour-board/shared'

export interface ProfileRepository {
  list(): Promise<Profile[]>
  findByPk(pk: PublicKey): Promise<Profile | null>
  create(input: CreateProfileInput): Promise<Profile>
  update(pk: PublicKey, input: UpdateProfileInput): Promise<Profile | null>
}

type MongoProfileDocument = Profile & Document

function withoutMongoId(document: MongoProfileDocument): Profile {
  return {
    pk: document.pk,
    name: document.name,
    avatarUrl: document.avatarUrl ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}

function profileFromInput(
  input: CreateProfileInput,
  now: string,
): Profile {
  return {
    pk: input.pk,
    name: input.name,
    avatarUrl: input.avatarUrl || null,
    createdAt: now,
    updatedAt: now,
  }
}

export class MemoryProfileRepository implements ProfileRepository {
  private profiles: Profile[] = []

  async list(): Promise<Profile[]> {
    return structuredClone(
      [...this.profiles].sort(profileSort),
    )
  }

  async findByPk(pk: PublicKey): Promise<Profile | null> {
    const profile = this.profiles.find((p) => p.pk === pk) ?? null
    return profile ? structuredClone(profile) : null
  }

  async create(input: CreateProfileInput): Promise<Profile> {
    const now = new Date().toISOString()
    const profile = profileFromInput(input, now)
    this.profiles.push(structuredClone(profile))
    return structuredClone(profile)
  }

  async update(
    pk: PublicKey,
    input: UpdateProfileInput,
  ): Promise<Profile | null> {
    const index = this.profiles.findIndex((p) => p.pk === pk)
    if (index === -1) return null

    const current = this.profiles[index]
    const now = new Date().toISOString()
    const updated: Profile = {
      ...current,
      name: input.name !== undefined ? input.name : current.name,
      avatarUrl:
        input.avatarUrl !== undefined ? (input.avatarUrl || null) : current.avatarUrl,
      updatedAt: now,
    }
    this.profiles[index] = updated
    return structuredClone(updated)
  }
}

export class MongoProfileRepository implements ProfileRepository {
  private readonly collection: Collection<MongoProfileDocument>

  constructor(collection: Collection<MongoProfileDocument>) {
    this.collection = collection
  }

  async list(): Promise<Profile[]> {
    const profiles = await this.collection
      .find({})
      .sort({ name: 1, pk: 1 })
      .toArray()
    return profiles.map(withoutMongoId)
  }

  async findByPk(pk: PublicKey): Promise<Profile | null> {
    const profile = await this.collection.findOne({ pk })
    return profile ? withoutMongoId(profile) : null
  }

  async create(input: CreateProfileInput): Promise<Profile> {
    const now = new Date().toISOString()
    const profile = profileFromInput(input, now)
    await this.collection.insertOne(profile as OptionalId<MongoProfileDocument>)
    return profile
  }

  async update(
    pk: PublicKey,
    input: UpdateProfileInput,
  ): Promise<Profile | null> {
    const current = await this.findByPk(pk)
    if (!current) return null

    const now = new Date().toISOString()
    const updated: Profile = {
      ...current,
      name: input.name !== undefined ? input.name : current.name,
      avatarUrl:
        input.avatarUrl !== undefined ? (input.avatarUrl || null) : current.avatarUrl,
      updatedAt: now,
    }
    const result = await this.collection.findOneAndReplace({ pk }, updated, {
      returnDocument: 'after',
    })

    return result ? withoutMongoId(result) : null
  }
}

function profileSort(a: Profile, b: Profile): number {
  const nameCompare = a.name.localeCompare(b.name)
  if (nameCompare !== 0) return nameCompare
  return a.pk.localeCompare(b.pk)
}
