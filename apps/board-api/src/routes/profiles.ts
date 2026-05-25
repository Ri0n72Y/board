import { Hono } from 'hono'
import type {
  ApiResponse,
  CreateProfileInput,
  Profile,
  UpdateProfileInput,
} from '@labour-board/shared'
import { error, ok } from '../http/responses.js'
import {
  ProfileConflictError,
  ProfileValidationError,
  type ProfileService,
} from '../services/profileService.js'

export function createProfilesRoute(profileService: ProfileService): Hono {
  const profiles = new Hono()

  profiles.get('/', async (c) => {
    const data = await profileService.list()
    return c.json<ApiResponse<Profile[]>>(ok(data))
  })

  profiles.get('/:pk', async (c) => {
    const profile = await profileService.findByPk(c.req.param('pk'))
    if (!profile) {
      return c.json(error('NOT_FOUND', 'Profile not found'), 404)
    }

    return c.json<ApiResponse<Profile>>(ok(profile))
  })

  profiles.post('/', async (c) => {
    const input = await c.req.json<CreateProfileInput>()
    try {
      const profile = await profileService.create(input)
      return c.json<ApiResponse<Profile>>(ok(profile), 201)
    } catch (caught) {
      if (caught instanceof ProfileValidationError) {
        return c.json(error('INVALID_PROFILE', caught.message), 400)
      }

      if (caught instanceof ProfileConflictError) {
        return c.json(error('PROFILE_EXISTS', caught.message), 409)
      }

      throw caught
    }
  })

  profiles.patch('/:pk', async (c) => {
    const input = await c.req.json<UpdateProfileInput>()
    try {
      const profile = await profileService.update(c.req.param('pk'), input)
      if (!profile) {
        return c.json(error('NOT_FOUND', 'Profile not found'), 404)
      }

      return c.json<ApiResponse<Profile>>(ok(profile))
    } catch (caught) {
      if (caught instanceof ProfileValidationError) {
        return c.json(error('INVALID_PROFILE', caught.message), 400)
      }

      throw caught
    }
  })

  return profiles
}
