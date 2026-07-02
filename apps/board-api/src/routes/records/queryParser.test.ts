import { describe, expect, it } from 'vitest'
import { parseQuery } from './queryParser.js'

function parse(query: string) {
  return parseQuery(new URLSearchParams(query))
}

describe('parseQuery', () => {
  it('merges tag and tags compatibility parameters', () => {
    const query = parse(
      'tag=status:wip&tag=%20&tags=topic:a&tags=status:wip&tags='
    )

    expect(query.tags).toEqual(['status:wip', 'topic:a'])
    expect(query.tagMatch).toBe('any')
  })
})
