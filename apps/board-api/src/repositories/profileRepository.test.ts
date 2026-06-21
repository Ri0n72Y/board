import type { Collection, Document } from 'mongodb'
import { describe, expect, it } from 'vitest'
import type { Profile } from '@labour-board/shared'
import {
  MemoryProfileRepository,
  MongoProfileRepository,
} from './profileRepository.js'

const BASE_INPUT = {
  pk: 'member-1',
  name: 'Ada',
}

describe('MemoryProfileRepository', () => {
  it('creates, lists, finds, and updates profiles', async () => {
    const repository = new MemoryProfileRepository()

    const created = await repository.create(BASE_INPUT)

    // Verify created has all fields
    expect(created.pk).toBe('member-1')
    expect(created.name).toBe('Ada')
    expect(created.avatarUrl).toBeNull()
    expect(created.createdAt).toBeDefined()
    expect(created.updatedAt).toBeDefined()

    await expect(repository.list()).resolves.toEqual([created])
    await expect(repository.findByPk('member-1')).resolves.toEqual(created)
    await expect(
      repository.update('member-1', {
        name: 'Ada Lovelace',
        avatarUrl: 'https://example.com/ada.png',
      }),
    ).resolves.toMatchObject({
      pk: 'member-1',
      name: 'Ada Lovelace',
      avatarUrl: 'https://example.com/ada.png',
    })
    await expect(repository.update('missing', { name: 'X' })).resolves.toBeNull()
  })

  it('list returns sorted by name then pk', async () => {
    const repository = new MemoryProfileRepository()
    await repository.create({ pk: 'pk-c', name: 'Charlie' })
    await repository.create({ pk: 'pk-a', name: 'Alice' })
    await repository.create({ pk: 'pk-b', name: 'Alice' })

    const profiles = await repository.list()
    expect(profiles.map((p) => p.pk)).toEqual(['pk-a', 'pk-b', 'pk-c'])
  })

  it('list returns clones — external mutations do not affect internal state', async () => {
    const repository = new MemoryProfileRepository()
    await repository.create(BASE_INPUT)

    const profiles = await repository.list()
    profiles[0].name = 'Corrupted'

    const refetch = await repository.list()
    expect(refetch[0].name).toBe('Ada')
  })

  it('create with avatarUrl saves the URL', async () => {
    const repository = new MemoryProfileRepository()
    const created = await repository.create({
      pk: 'member-2',
      name: 'Bob',
      avatarUrl: 'https://example.com/bob.png',
    })
    expect(created.avatarUrl).toBe('https://example.com/bob.png')
  })

  it('update clears avatarUrl when passed empty string', async () => {
    const repository = new MemoryProfileRepository()
    await repository.create({
      pk: 'member-3',
      name: 'Eve',
      avatarUrl: 'https://example.com/eve.png',
    })

    const updated = await repository.update('member-3', {
      avatarUrl: '',
    })
    expect(updated?.avatarUrl).toBeNull()
  })
})

describe('MongoProfileRepository', () => {
  it('lists, creates, finds, and updates profiles through the collection', async () => {
    const inserted: unknown[] = []
    const replacements: unknown[] = []

    const stubProfile: Profile = {
      pk: 'member-1',
      name: 'Ada',
      avatarUrl: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    }

    const collectionMethods: Record<string, unknown> = {
      find(): Record<string, unknown> {
        return {
          sort: () => ({
            toArray: async () => [{ ...stubProfile, _id: 'mongo-id' }],
          }),
        }
      },
      insertOne(profile: unknown) {
        inserted.push(profile)
        return Promise.resolve()
      },
      findOne() {
        return Promise.resolve({ ...stubProfile, _id: 'mongo-id' })
      },
      findOneAndReplace(_filter: unknown, replacement: unknown) {
        replacements.push(replacement)
        return Promise.resolve({
          ...(replacement as Profile),
          _id: 'mongo-id',
        })
      },
    }

    const repository = new MongoProfileRepository(
      collectionMethods as unknown as Collection<Profile & Document>,
    )

    await expect(repository.list()).resolves.toEqual([stubProfile])

    const created = await repository.create(BASE_INPUT)
    expect(created.pk).toBe('member-1')
    expect(inserted).toHaveLength(1)

    await expect(repository.findByPk('member-1')).resolves.toEqual(stubProfile)

    await expect(
      repository.update('member-1', { name: 'Ada Lovelace' }),
    ).resolves.toMatchObject({ name: 'Ada Lovelace' })
    expect(replacements).toHaveLength(1)
  })
})
