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
    })

    expect(created).toMatchObject({
      pk: 'member-1',
      name: 'Ada',
      avatarUrl: null,
    })
    expect(created.createdAt).toBeDefined()
    expect(created.updatedAt).toBeDefined()
    await expect(service.list()).resolves.toEqual([created])
    await expect(service.findByPk('member-1')).resolves.toEqual(created)

    const updated = await service.update('member-1', {
      name: 'Ada Lovelace',
      avatarUrl: 'https://example.com/ada.png',
    })

    expect(updated).toMatchObject({
      pk: 'member-1',
      name: 'Ada Lovelace',
      avatarUrl: 'https://example.com/ada.png',
    })
  })

  it('returns null when updating a missing profile', async () => {
    const service = createService()

    await expect(
      service.update('missing', { name: 'Missing' }),
    ).resolves.toBeNull()
  })

  it('rejects invalid profile input', async () => {
    const service = createService()

    await expect(
      service.create({ pk: '', name: 'No key' }),
    ).rejects.toThrow(ProfileValidationError)
    await expect(
      service.create({ pk: 'member-1', name: 1 as unknown as string }),
    ).rejects.toThrow('Profile name must be a string')
  })

  it('rejects blank profile names', async () => {
    const service = createService()

    await expect(
      service.create({ pk: 'member-1', name: '' }),
    ).rejects.toThrow(ProfileValidationError)
    await expect(
      service.create({ pk: 'member-1', name: '   ' }),
    ).rejects.toThrow(ProfileValidationError)
  })

  it('rejects duplicate profile keys', async () => {
    const service = createService()
    await service.create({ pk: 'member-1', name: 'Ada' })

    await expect(
      service.create({ pk: 'member-1', name: 'Other Ada' }),
    ).rejects.toThrow(ProfileConflictError)
  })

  it('rejects invalid avatarUrl', async () => {
    const service = createService()

    await expect(
      service.create({
        pk: 'member-1',
        name: 'Ada',
        avatarUrl: 'ftp://bad.example.com',
      }),
    ).rejects.toThrow(ProfileValidationError)
  })

  it('allows empty or null avatarUrl when creating', async () => {
    const service = createService()

    await expect(
      service.create({ pk: 'member-1', name: 'Ada', avatarUrl: '' }),
    ).resolves.toMatchObject({ avatarUrl: null })
    await expect(
      service.create({ pk: 'member-2', name: 'Bob' }),
    ).resolves.toMatchObject({ avatarUrl: null })
  })

  it('allows clearing avatarUrl via update', async () => {
    const service = createService()
    await service.create({
      pk: 'member-1',
      name: 'Ada',
      avatarUrl: 'https://example.com/ada.png',
    })

    await expect(
      service.update('member-1', { avatarUrl: '' }),
    ).resolves.toMatchObject({ avatarUrl: null })
  })

  it('rejects sensitive fields in create input', async () => {
    const service = createService()

    await expect(
      service.create({
        pk: 'member-x',
        name: 'X',
        privateKey: 'secret' as unknown as string,
      } as never),
    ).rejects.toThrow(ProfileValidationError)

    await expect(
      service.create({
        pk: 'member-x',
        name: 'X',
        password: 'secret' as unknown as string,
      } as never),
    ).rejects.toThrow(ProfileValidationError)

    await expect(
      service.create({
        pk: 'member-x',
        name: 'X',
        secretKey: 'secret' as unknown as string,
      } as never),
    ).rejects.toThrow(ProfileValidationError)

    await expect(
      service.create({
        pk: 'member-x',
        name: 'X',
        seedPhrase: 'secret' as unknown as string,
      } as never),
    ).rejects.toThrow(ProfileValidationError)
  })

  it('rejects body.pk mismatch in PATCH', async () => {
    const service = createService()
    await service.create({ pk: 'member-a', name: 'Alice' })

    await expect(
      service.update('member-a', {
        pk: 'member-b',
        name: 'Bob',
      }),
    ).rejects.toThrow(ProfileValidationError)
  })

  it('returns null when finding a non-existent profile', async () => {
    const service = createService()
    await expect(service.findByPk('nobody')).resolves.toBeNull()
  })

  // ─── Normalization tests ───

  it('create trims pk and name before saving', async () => {
    const service = createService()

    const created = await service.create({
      pk: '  member-1  ',
      name: '  Ada Lovelace  ',
    })

    expect(created.pk).toBe('member-1')
    expect(created.name).toBe('Ada Lovelace')
  })

  it('create treats whitespace avatarUrl as null', async () => {
    const service = createService()

    const created1 = await service.create({
      pk: 'member-1',
      name: 'Ada',
      avatarUrl: '   ',
    })
    expect(created1.avatarUrl).toBeNull()

    const created2 = await service.create({
      pk: 'member-2',
      name: 'Bob',
      avatarUrl: '',
    })
    expect(created2.avatarUrl).toBeNull()
  })

  it('create with pk " member-1 " then "member-1" returns 409', async () => {
    const service = createService()
    await service.create({ pk: '  member-1  ', name: 'First' })

    await expect(
      service.create({ pk: 'member-1', name: 'Second' }),
    ).rejects.toThrow(ProfileConflictError)
  })

  it('update trims name', async () => {
    const service = createService()
    await service.create({ pk: 'member-1', name: 'Ada' })

    const updated = await service.update('member-1', {
      name: '  Ada Lovelace  ',
    })
    expect(updated?.name).toBe('Ada Lovelace')
  })

  it('update trims avatarUrl', async () => {
    const service = createService()
    await service.create({ pk: 'member-1', name: 'Ada' })

    const updated = await service.update('member-1', {
      avatarUrl: '  https://example.com/ada.png  ',
    })
    expect(updated?.avatarUrl).toBe('https://example.com/ada.png')
  })

  it('PATCH body.pk with surrounding spaces matches path pk', async () => {
    const service = createService()
    await service.create({ pk: 'member-a', name: 'Alice' })

    const updated = await service.update('member-a', {
      pk: '  member-a  ',
      name: 'Alice 2',
    })
    expect(updated?.name).toBe('Alice 2')
  })

  it('PATCH body.pk with different trimmed value returns 400', async () => {
    const service = createService()
    await service.create({ pk: 'member-a', name: 'Alice' })

    await expect(
      service.update('member-a', {
        pk: '  member-b  ',
        name: 'Bob',
      }),
    ).rejects.toThrow(ProfileValidationError)
  })

  // ─── Malformed input tests ───

  it('create rejects non-string avatarUrl with ProfileValidationError', async () => {
    const service = createService()

    await expect(
      service.create({
        pk: 'member-1',
        name: 'Ada',
        avatarUrl: 123 as unknown as string,
      }),
    ).rejects.toThrow(ProfileValidationError)
  })

  it('update rejects non-string pk with ProfileValidationError', async () => {
    const service = createService()
    await service.create({ pk: 'member-a', name: 'Alice' })

    await expect(
      service.update('member-a', {
        pk: 123 as unknown as string,
      }),
    ).rejects.toThrow(ProfileValidationError)
  })

  it('update rejects non-string avatarUrl with ProfileValidationError', async () => {
    const service = createService()
    await service.create({ pk: 'member-a', name: 'Alice' })

    await expect(
      service.update('member-a', {
        avatarUrl: 456 as unknown as string,
      }),
    ).rejects.toThrow(ProfileValidationError)
  })
})
