import { describe, expect, it } from 'vitest'
import type { AgentContextProfile } from '@labour-board/shared'
import {
  AGENT_CONTEXT_PROFILE_DEFINITIONS,
  getAgentContextProfileDefinition,
  getBoardExportLevelForProfile,
  listAgentContextProfiles,
} from '@labour-board/shared'

const ALL_PROFILES: AgentContextProfile[] = [
  'agent-full',
  'agent-filtered',
  'agent-card',
  'agent-related',
  'agent-sprint',
  'human-summary',
  'agent-snapshot',
]

describe('agent context profile registry', () => {
  it('covers every profile exactly once', () => {
    expect(AGENT_CONTEXT_PROFILE_DEFINITIONS.map((definition) => definition.id)).toEqual(
      ALL_PROFILES
    )
    expect(
      new Set(AGENT_CONTEXT_PROFILE_DEFINITIONS.map((definition) => definition.id)).size
    ).toBe(ALL_PROFILES.length)
  })

  it('maps profiles to legal export levels', () => {
    for (const profile of ALL_PROFILES) {
      const definition = getAgentContextProfileDefinition(profile)
      expect(getBoardExportLevelForProfile(profile)).toBe(definition.level)
      expect(definition.level).toMatch(/^(full|summary|meta|card|related|sprint|filtered)$/)
    }
  })

  it('declares the expected profile constraints', () => {
    expect(getAgentContextProfileDefinition('agent-card').requiresRecord).toBe(true)
    expect(getAgentContextProfileDefinition('agent-sprint').requiresSprint).toBe(true)
    expect(getAgentContextProfileDefinition('agent-filtered').usesCurrentFilters).toBe(true)
    expect(getAgentContextProfileDefinition('agent-snapshot').source).toBe('snapshot')
    expect(getAgentContextProfileDefinition('human-summary').defaultIncludeContent).toBe(false)
  })

  it('filters snapshot-only profiles out of current-board listings', () => {
    const currentBoardProfiles = listAgentContextProfiles('current-board').map(
      (definition) => definition.id
    )
    const snapshotProfiles = listAgentContextProfiles('snapshot').map(
      (definition) => definition.id
    )

    expect(currentBoardProfiles).not.toContain('agent-snapshot')
    expect(snapshotProfiles).toContain('agent-snapshot')
    expect(snapshotProfiles[0]).toBe('agent-snapshot')
    expect(snapshotProfiles[1]).toBe('human-summary')
  })
})
