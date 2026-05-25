import type { Collection, Document } from 'mongodb'
import { describe, expect, it } from 'vitest'
import type { Profile } from '@labour-board/shared'
import {
  MemoryProfileRepository,
  MongoProfileRepository,
} from './profileRepository.js'

const BASE_PROFILE: Profile = {
  pk: 'member-1',
  name: 'Ada',
  extra: { role: 'programmer' },
}

describe('MemoryProfileRepository', () => {
  it('creates, lists, finds, and updates profiles', async () => {
    const repository = new MemoryProfileRepository()

    await repository.create(BASE_PROFILE)

    await expect(repository.list()).resolves.toEqual([BASE_PROFILE])
    await expect(repository.findByPk(BASE_PROFILE.pk)).resolves.toEqual(
      BASE_PROFILE
    )
    await expect(
      repository.update(BASE_PROFILE.pk, {
        name: 'Ada Lovelace',
        extra: null,
      })
    ).resolves.toEqual({
      pk: 'member-1',
      name: 'Ada Lovelace',
      extra: undefined,
    })
    await expect(repository.update('missing', {})).resolves.toBeNull()
  })
})

describe('MongoProfileRepository', () => {
  it('lists, creates, finds, and updates profiles through the collection', async () => {
    const inserted: unknown[] = []
    const replacements: unknown[] = []
    const repository = new MongoProfileRepository(
      createCollectionStub({
        find() {
          return {
            toArray: async () => [{ ...BASE_PROFILE, _id: 'mongo-id' }],
          }
        },
        insertOne(profile: unknown) {
          inserted.push(profile)
          return Promise.resolve()
        },
        findOne() {
          return Promise.resolve({ ...BASE_PROFILE, _id: 'mongo-id' })
        },
        findOneAndReplace(filter: unknown, replacement: unknown) {
          replacements.push({ filter, replacement })
          return Promise.resolve({ ...(replacement as Profile), _id: 'mongo-id' })
        },
      })
    )

    await expect(repository.list()).resolves.toEqual([BASE_PROFILE])
    await expect(repository.create(BASE_PROFILE)).resolves.toEqual(BASE_PROFILE)
    expect(inserted).toEqual([BASE_PROFILE])
    await expect(repository.findByPk(BASE_PROFILE.pk)).resolves.toEqual(
      BASE_PROFILE
    )
    await expect(
      repository.update(BASE_PROFILE.pk, { name: 'Ada Lovelace' })
    ).resolves.toMatchObject({ name: 'Ada Lovelace' })
    expect(replacements).toHaveLength(1)
  })
})

function createCollectionStub(
  methods: Record<string, unknown>
): Collection<Profile & Document> {
  return methods as unknown as Collection<Profile & Document>
}
