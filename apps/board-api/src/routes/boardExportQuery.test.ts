import { describe, expect, it } from 'vitest'
import { parseBoardExportOptions, BoardExportQueryError } from './boardExportQuery.js'

describe('parseBoardExportOptions', () => {
  it('rejects invalid profiles and conflicting profile/level combinations', () => {
    expect(() =>
      parseBoardExportOptions(new URLSearchParams('profile=bad'), 'current-board')
    ).toThrow(BoardExportQueryError)

    expect(() =>
      parseBoardExportOptions(
        new URLSearchParams('profile=agent-full&level=summary'),
        'current-board'
      )
    ).toThrow('level cannot be combined with profile')
  })

  it('rejects snapshot-only profiles on current-board exports', () => {
    expect(() =>
      parseBoardExportOptions(
        new URLSearchParams('profile=agent-snapshot'),
        'current-board'
      )
    ).toThrow('agent-snapshot is only available for snapshot exports')
  })

  it('requires recordId and sprintTag for the relevant profiles', () => {
    expect(() =>
      parseBoardExportOptions(
        new URLSearchParams('profile=agent-card'),
        'current-board'
      )
    ).toThrow('agent-card requires a recordId')

    expect(() =>
      parseBoardExportOptions(
        new URLSearchParams('profile=agent-sprint'),
        'current-board'
      )
    ).toThrow('agent-sprint requires a sprintTag')
  })

  it('accepts snapshot exports and applies profile defaults', () => {
    const options = parseBoardExportOptions(
      new URLSearchParams('profile=agent-snapshot'),
      'snapshot',
      { id: 'snapshot-1', createdAt: '2026-06-05T00:00:00.000Z' }
    )

    expect(options).toMatchObject({
      source: 'snapshot',
      profile: 'agent-snapshot',
      level: 'full',
      includeContent: true,
      includeAssets: true,
      includeRelations: true,
      includeDiagnostics: true,
      snapshotId: 'snapshot-1',
    })
  })

  it('supports human summary defaults without full content override', () => {
    const options = parseBoardExportOptions(
      new URLSearchParams('profile=human-summary'),
      'current-board'
    )

    expect(options).toMatchObject({
      profile: 'human-summary',
      level: 'summary',
      includeContent: false,
      includeAssets: false,
      includeRelations: false,
      includeDiagnostics: false,
    })
  })

  it('accepts valid record and filtered profiles', () => {
    const related = parseBoardExportOptions(
      new URLSearchParams('profile=agent-related&recordId=record-1'),
      'current-board'
    )
    expect(related).toMatchObject({
      profile: 'agent-related',
      level: 'related',
      recordId: 'record-1',
    })

    const filtered = parseBoardExportOptions(
      new URLSearchParams('profile=agent-filtered&q=alpha'),
      'current-board'
    )
    expect(filtered).toMatchObject({
      profile: 'agent-filtered',
      level: 'filtered',
      includeContent: true,
    })
  })
})
