import { DEFAULT_BOARD_CONFIG } from '@labour-board/shared'
import { describe, expect, it } from 'vitest'
import { cleanExcludeTags } from './boardConfig.js'

describe('board config tools', () => {
  it('can manually clean snapshot exclude tags', () => {
    const cleaned = cleanExcludeTags({
      ...DEFAULT_BOARD_CONFIG,
      snapshot: {
        excludeTags: ['status:archived', 'missing:tag'],
      },
    })

    expect(cleaned.snapshot.excludeTags).toEqual(['status:archived'])
  })
})
