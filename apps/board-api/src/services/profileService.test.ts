import { describe, expect, it } from 'vitest'
import { MemoryProfileRepository } from '../repositories/profileRepository.js'
import {
  ProfileConflictError,
  ProfileService,
  ProfileValidationError,
} from './profileService.js'

function createService(): ProfileService {
  return new ProfileService(new MemoryProfileRepository())
}

describe('ProfileService', () => {
  it('creates, lists, reads, and updates profiles', async () => {
    const service = createService()

    const created = await service.create({
      pk: 'member-1',
      name: 'Ada',
      extra: { role: 'programmer' },
    })

    expect(created).toEqual({
      pk: 'member-1',
      name: 'Ada',
      extra: { role: 'programmer' },
    })
    await expect(service.list()).resolves.toEqual([created])
    await expect(service.findByPk('member-1')).resolves.toEqual(created)

    const updated = await service.update('member-1', {
      name: 'Ada Lovelace',
      extra: null,
    })

    expect(updated).toEqual({
      pk: 'member-1',
      name: 'Ada Lovelace',
      extra: undefined,
    })
  })

  it('returns null when updating a missing profile', async () => {
    const service = createService()

    await expect(
      service.update('missing', { name: 'Missing' })
    ).resolves.toBeNull()
  })

  it('rejects invalid profile input', async () => {
    const service = createService()

    await expect(
      service.create({ pk: '', name: 'No key' })
    ).rejects.toThrow(ProfileValidationError)
    await expect(
      service.create({ pk: 'member-1', name: '' })
    ).rejects.toThrow('Profile name is required')
    await expect(
      service.update('member-1', { name: '   ' })
    ).rejects.toThrow('Profile name cannot be empty')
  })

  it('rejects duplicate profile keys', async () => {
    const service = createService()
    await service.create({ pk: 'member-1', name: 'Ada' })

    await expect(
      service.create({ pk: 'member-1', name: 'Other Ada' })
    ).rejects.toThrow(ProfileConflictError)
  })
})
