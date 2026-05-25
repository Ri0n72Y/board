import { describe, expect, it } from 'vitest'
import { error, ok } from './responses.js'

describe('HTTP responses', () => {
  it('wraps successful data', () => {
    expect(ok({ status: 'ok' })).toEqual({
      ok: true,
      data: { status: 'ok' },
    })
  })

  it('wraps error details', () => {
    expect(error('INVALID', 'Invalid input', { field: 'tags' })).toEqual({
      ok: false,
      error: {
        code: 'INVALID',
        message: 'Invalid input',
        details: { field: 'tags' },
      },
    })
  })
})
