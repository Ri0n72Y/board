import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { MemoryProfileRepository } from '../repositories/profileRepository.js'
import { ProfileService } from '../services/profileService.js'
import { createProfilesRoute } from './profiles.js'

function createApp(): Hono {
  const app = new Hono()
  const service = new ProfileService(new MemoryProfileRepository())
  app.route('/api/v0/profiles', createProfilesRoute(service))
  return app
}

describe('createProfilesRoute', () => {
  it('creates, lists, reads, and updates profiles', async () => {
    const app = createApp()

    const createResponse = await app.request('/api/v0/profiles', {
      method: 'POST',
      body: JSON.stringify({
        pk: 'member-1',
        name: 'Ada',
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()

    expect(createResponse.status).toBe(201)
    expect(createPayload.data).toMatchObject({
      pk: 'member-1',
      name: 'Ada',
      avatarUrl: null,
    })
    expect(createPayload.data.createdAt).toBeDefined()
    expect(createPayload.data.updatedAt).toBeDefined()

    const listResponse = await app.request('/api/v0/profiles')
    const listPayload = await listResponse.json()
    expect(listPayload.data).toHaveLength(1)

    const readResponse = await app.request('/api/v0/profiles/member-1')
    const readPayload = await readResponse.json()
    expect(readResponse.status).toBe(200)
    expect(readPayload.data.name).toBe('Ada')

    const patchResponse = await app.request('/api/v0/profiles/member-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Ada Lovelace' }),
      headers: { 'content-type': 'application/json' },
    })
    const patchPayload = await patchResponse.json()
    expect(patchResponse.status).toBe(200)
    expect(patchPayload.data.name).toBe('Ada Lovelace')
  })

  it('returns expected errors for invalid, duplicate, and missing profiles', async () => {
    const app = createApp()

    const invalidResponse = await app.request('/api/v0/profiles', {
      method: 'POST',
      body: JSON.stringify({ pk: '', name: 'No key' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(invalidResponse.status).toBe(400)

    const blankNameResponse = await app.request('/api/v0/profiles', {
      method: 'POST',
      body: JSON.stringify({ pk: 'member-x', name: '   ' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(blankNameResponse.status).toBe(400)

    await app.request('/api/v0/profiles', {
      method: 'POST',
      body: JSON.stringify({ pk: 'member-1', name: 'Ada' }),
      headers: { 'content-type': 'application/json' },
    })
    const duplicateResponse = await app.request('/api/v0/profiles', {
      method: 'POST',
      body: JSON.stringify({ pk: 'member-1', name: 'Other Ada' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(duplicateResponse.status).toBe(409)

    const missingReadResponse = await app.request('/api/v0/profiles/missing')
    expect(missingReadResponse.status).toBe(404)

    const missingPatchResponse = await app.request('/api/v0/profiles/missing', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Missing' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(missingPatchResponse.status).toBe(404)
  })

  it('rejects invalid avatarUrl on create', async () => {
    const app = createApp()

    const response = await app.request('/api/v0/profiles', {
      method: 'POST',
      body: JSON.stringify({
        pk: 'member-1',
        name: 'Ada',
        avatarUrl: 'ftp://bad.example.com',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(response.status).toBe(400)
  })

  it('creates profile with valid avatarUrl', async () => {
    const app = createApp()

    const response = await app.request('/api/v0/profiles', {
      method: 'POST',
      body: JSON.stringify({
        pk: 'member-1',
        name: 'Ada',
        avatarUrl: 'https://example.com/ada.png',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.data.avatarUrl).toBe('https://example.com/ada.png')
  })

  it('clears avatarUrl on update with empty string', async () => {
    const app = createApp()

    await app.request('/api/v0/profiles', {
      method: 'POST',
      body: JSON.stringify({
        pk: 'member-1',
        name: 'Ada',
        avatarUrl: 'https://example.com/ada.png',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const patchResponse = await app.request('/api/v0/profiles/member-1', {
      method: 'PATCH',
      body: JSON.stringify({ avatarUrl: '' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(patchResponse.status).toBe(200)
    const patchPayload = await patchResponse.json()
    expect(patchPayload.data.avatarUrl).toBeNull()
  })

  it('rejects body.pk mismatch in PATCH', async () => {
    const app = createApp()

    await app.request('/api/v0/profiles', {
      method: 'POST',
      body: JSON.stringify({ pk: 'member-a', name: 'Alice' }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await app.request('/api/v0/profiles/member-a', {
      method: 'PATCH',
      body: JSON.stringify({ pk: 'member-b', name: 'Bob' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(response.status).toBe(400)
  })

  it('rejects sensitive fields in create', async () => {
    const app = createApp()

    const response = await app.request('/api/v0/profiles', {
      method: 'POST',
      body: JSON.stringify({
        pk: 'member-x',
        name: 'X',
        privateKey: 'secret',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(response.status).toBe(400)

    const response2 = await app.request('/api/v0/profiles', {
      method: 'POST',
      body: JSON.stringify({
        pk: 'member-x',
        name: 'X',
        password: 'secret',
      }),
      headers: { 'content-type': 'application/json' },
    })
    expect(response2.status).toBe(400)
  })
})
