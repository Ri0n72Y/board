import type { Collection, Document, OptionalId } from 'mongodb'
import type { Profile, PublicKey, UpdateProfileInput } from '@labour-board/shared'

export interface ProfileRepository {
  list(): Promise<Profile[]>
  findByPk(pk: PublicKey): Promise<Profile | null>
  create(profile: Profile): Promise<Profile>
  update(pk: PublicKey, input: UpdateProfileInput): Promise<Profile | null>
}

type MongoProfileDocument = Profile & Document

function withoutMongoId(document: MongoProfileDocument): Profile {
  return {
    pk: document.pk,
    name: document.name,
    extra: document.extra,
  }
}

export class MemoryProfileRepository implements ProfileRepository {
  private profiles: Profile[] = []

  async list(): Promise<Profile[]> {
    return [...this.profiles]
  }

  async findByPk(pk: PublicKey): Promise<Profile | null> {
    return this.profiles.find((profile) => profile.pk === pk) ?? null
  }

  async create(profile: Profile): Promise<Profile> {
    this.profiles.push(profile)
    return profile
  }

  async update(
    pk: PublicKey,
    input: UpdateProfileInput
  ): Promise<Profile | null> {
    const index = this.profiles.findIndex((profile) => profile.pk === pk)
    if (index === -1) {
      return null
    }

    const current = this.profiles[index]
    const updated: Profile = {
      ...current,
      name: input.name ?? current.name,
      extra: input.extra === undefined ? current.extra : input.extra ?? undefined,
    }
    this.profiles[index] = updated
    return updated
  }
}

export class MongoProfileRepository implements ProfileRepository {
  private readonly collection: Collection<MongoProfileDocument>

  constructor(collection: Collection<MongoProfileDocument>) {
    this.collection = collection
  }

  async list(): Promise<Profile[]> {
    const profiles = await this.collection.find({}).toArray()
    return profiles.map(withoutMongoId)
  }

  async findByPk(pk: PublicKey): Promise<Profile | null> {
    const profile = await this.collection.findOne({ pk })
    return profile ? withoutMongoId(profile) : null
  }

  async create(profile: Profile): Promise<Profile> {
    await this.collection.insertOne(profile as OptionalId<MongoProfileDocument>)
    return profile
  }

  async update(
    pk: PublicKey,
    input: UpdateProfileInput
  ): Promise<Profile | null> {
    const current = await this.findByPk(pk)
    if (!current) {
      return null
    }

    const updated: Profile = {
      ...current,
      name: input.name ?? current.name,
      extra: input.extra === undefined ? current.extra : input.extra ?? undefined,
    }
    const result = await this.collection.findOneAndReplace({ pk }, updated, {
      returnDocument: 'after',
    })

    return result ? withoutMongoId(result) : null
  }
}
