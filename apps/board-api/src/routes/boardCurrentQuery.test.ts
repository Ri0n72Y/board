import { describe, expect, it } from 'vitest'
import { parseBoardCurrentQuery } from './boardCurrentQuery.js'

function parse(query: string) {
  return parseBoardCurrentQuery(new URLSearchParams(query))
}

describe('parseBoardCurrentQuery', () => {
  it('parses includeArchived=true', () => {
    const query = parse('includeArchived=true')

    expect(query.includeArchived).toBe(true)
    expect(query.tagMatch).toBe('any')
  })

  it('parses repeated tags values', () => {
    const query = parse('tags=status:wip&tags=priority:urgent-important')

    expect(query.tags).toEqual(['status:wip', 'priority:urgent-important'])
    expect(query.tagMatch).toBe('any')
    expect(query.includeArchived).toBe(false)
  })

  it('keeps single tag compatibility', () => {
    const query = parse('tag=status:wip')

    expect(query.tags).toEqual(['status:wip'])
    expect(query.tagMatch).toBe('any')
    expect(query.includeArchived).toBe(false)
  })

  it('merges tag and tags compatibility parameters', () => {
    const query = parse(
      'tag=status:wip&tag=%20&tags=topic:a&tags=status:wip&tags='
    )

    expect(query.tags).toEqual(['status:wip', 'topic:a'])
    expect(query.tagMatch).toBe('any')
  })

  it('parses tagMatch=any', () => {
    const query = parse('tagMatch=any')

    expect(query.tagMatch).toBe('any')
    expect(query.includeArchived).toBe(false)
  })

  it('defaults tagMatch to any', () => {
    expect(parse('tags=status:wip').tagMatch).toBe('any')
  })

  it('normalizes legacy tagMatch=all to any', () => {
    expect(parse('tags=status:wip&tags=status:todo&tagMatch=all')).toEqual({
      tags: ['status:wip', 'status:todo'],
      tagMatch: 'any',
      includeArchived: false,
    })
  })

  it('ignores schema because board current has no user schema filter', () => {
    const query = parse('schema=CardBody&tags=status:wip')

    expect(query.tags).toEqual(['status:wip'])
    expect(query.tagMatch).toBe('any')
    expect(query.includeArchived).toBe(false)
    expect(query).not.toHaveProperty('schema')
  })

  it('ignores unknown query parameters', () => {
    const query = parse('unknown=value&tags=status:wip')

    expect(query.tags).toEqual(['status:wip'])
    expect(query.tagMatch).toBe('any')
    expect(query.includeArchived).toBe(false)
    expect(query).not.toHaveProperty('unknown')
  })
})
