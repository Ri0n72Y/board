import { describe, expect, it } from 'vitest'
import { parseBoardCurrentQuery } from './boardCurrentQuery.js'

function parse(query: string) {
  return parseBoardCurrentQuery(new URLSearchParams(query))
}

describe('parseBoardCurrentQuery', () => {
  it('parses includeArchived=true', () => {
    const query = parse('includeArchived=true')

    expect(query.includeArchived).toBe(true)
    expect(query.tagMatch).toBe('all')
  })

  it('parses repeated tags values', () => {
    const query = parse('tags=status:wip&tags=priority:urgent-important')

    expect(query.tags).toEqual(['status:wip', 'priority:urgent-important'])
    expect(query.tagMatch).toBe('all')
    expect(query.includeArchived).toBe(false)
  })

  it('keeps single tag compatibility', () => {
    const query = parse('tag=status:wip')

    expect(query.tags).toEqual(['status:wip'])
    expect(query.tagMatch).toBe('all')
    expect(query.includeArchived).toBe(false)
  })

  it('parses tagMatch=any', () => {
    const query = parse('tagMatch=any')

    expect(query.tagMatch).toBe('any')
    expect(query.includeArchived).toBe(false)
  })

  it('defaults tagMatch to all', () => {
    expect(parse('tags=status:wip').tagMatch).toBe('all')
  })

  it('ignores schema because board current has no user schema filter', () => {
    const query = parse('schema=CardBody&tags=status:wip')

    expect(query.tags).toEqual(['status:wip'])
    expect(query.tagMatch).toBe('all')
    expect(query.includeArchived).toBe(false)
    expect(query).not.toHaveProperty('schema')
  })

  it('ignores unknown query parameters', () => {
    const query = parse('unknown=value&tags=status:wip')

    expect(query.tags).toEqual(['status:wip'])
    expect(query.tagMatch).toBe('all')
    expect(query.includeArchived).toBe(false)
    expect(query).not.toHaveProperty('unknown')
  })
})
