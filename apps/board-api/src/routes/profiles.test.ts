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
        extra: { role: 'programmer' },
      }),
      headers: { 'content-type': 'application/json' },
    })
    const createPayload = await createResponse.json()

    expect(createResponse.status).toBe(201)
    expect(createPayload.data).toEqual({
      pk: 'member-1',
      name: 'Ada',
      extra: { role: 'programmer' },
    })

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

    const blankPatchResponse = await app.request('/api/v0/profiles/member-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: '   ' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(blankPatchResponse.status).toBe(200)
  })
})
