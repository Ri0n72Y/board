import type {
  BoardCurrentQuery,
  BoardExportLevel,
  BoardExportSource,
  AgentContextProfile,
} from '../interfaces/index.js'

export interface AgentContextProfileDefinition {
  id: AgentContextProfile
  label: string
  description: string
  source: 'current-board' | 'snapshot' | 'both'
  level: BoardExportLevel
  requiresRecord: boolean
  requiresSprint: boolean
  usesCurrentFilters: boolean
  defaultIncludeContent: boolean
  defaultIncludeAssets: boolean
  defaultIncludeRelations: boolean
  defaultIncludeDiagnostics: boolean
  agentReadingPurpose: string
}

export interface AgentContextProfileOptions {
  source: BoardExportSource
  profile: AgentContextProfile
  recordId?: string
  sprintTag?: string
  filters?: BoardCurrentQuery
}

export const AGENT_CONTEXT_PROFILE_DEFINITIONS: readonly AgentContextProfileDefinition[] =
  [
    {
      id: 'agent-full',
      label: 'Agent Full Context',
      description:
        'Complete board context with records, relations, assets, and diagnostics.',
      source: 'both',
      level: 'full',
      requiresRecord: false,
      requiresSprint: false,
      usesCurrentFilters: false,
      defaultIncludeContent: true,
      defaultIncludeAssets: true,
      defaultIncludeRelations: true,
      defaultIncludeDiagnostics: true,
      agentReadingPurpose:
        'Use this preset when the agent needs the broadest board picture for reasoning.',
    },
    {
      id: 'agent-filtered',
      label: 'Current Filters Context',
      description:
        'Exports the current visible scope using the active board filters.',
      source: 'both',
      level: 'filtered',
      requiresRecord: false,
      requiresSprint: false,
      usesCurrentFilters: true,
      defaultIncludeContent: true,
      defaultIncludeAssets: true,
      defaultIncludeRelations: true,
      defaultIncludeDiagnostics: true,
      agentReadingPurpose:
        'Use this preset when the agent should reason only about the board slice the user is currently viewing.',
    },
    {
      id: 'agent-card',
      label: 'Single Card Context',
      description: 'Focuses on one card plus its direct content and metadata.',
      source: 'both',
      level: 'card',
      requiresRecord: true,
      requiresSprint: false,
      usesCurrentFilters: false,
      defaultIncludeContent: true,
      defaultIncludeAssets: true,
      defaultIncludeRelations: true,
      defaultIncludeDiagnostics: true,
      agentReadingPurpose:
        'Use this preset when the agent should examine one specific card in depth.',
    },
    {
      id: 'agent-related',
      label: 'Related Cards Context',
      description:
        'Includes a source card and the directly connected related records.',
      source: 'both',
      level: 'related',
      requiresRecord: true,
      requiresSprint: false,
      usesCurrentFilters: false,
      defaultIncludeContent: true,
      defaultIncludeAssets: true,
      defaultIncludeRelations: true,
      defaultIncludeDiagnostics: true,
      agentReadingPurpose:
        'Use this preset when the agent needs to trace the local relation graph around one card.',
    },
    {
      id: 'agent-sprint',
      label: 'Sprint Context',
      description: 'Filters the board to a sprint tag and its related records.',
      source: 'both',
      level: 'sprint',
      requiresRecord: false,
      requiresSprint: true,
      usesCurrentFilters: false,
      defaultIncludeContent: true,
      defaultIncludeAssets: true,
      defaultIncludeRelations: true,
      defaultIncludeDiagnostics: true,
      agentReadingPurpose:
        'Use this preset when the agent should inspect a sprint-sized slice of work.',
    },
    {
      id: 'human-summary',
      label: 'Human Summary',
      description: 'Compact summary and metadata for quick human review.',
      source: 'both',
      level: 'summary',
      requiresRecord: false,
      requiresSprint: false,
      usesCurrentFilters: false,
      defaultIncludeContent: false,
      defaultIncludeAssets: false,
      defaultIncludeRelations: false,
      defaultIncludeDiagnostics: false,
      agentReadingPurpose:
        'Use this preset when a compact board summary is sufficient for review or handoff.',
    },
    {
      id: 'agent-snapshot',
      label: 'Agent Snapshot Context',
      description: 'Static checkpoint export from a snapshot source.',
      source: 'snapshot',
      level: 'full',
      requiresRecord: false,
      requiresSprint: false,
      usesCurrentFilters: false,
      defaultIncludeContent: true,
      defaultIncludeAssets: true,
      defaultIncludeRelations: true,
      defaultIncludeDiagnostics: true,
      agentReadingPurpose:
        'Use this preset when the agent should reason from a frozen checkpoint rather than the live board.',
    },
  ] as const

const PROFILE_INDEX = new Map<
  AgentContextProfile,
  AgentContextProfileDefinition
>(
  AGENT_CONTEXT_PROFILE_DEFINITIONS.map((definition) => [
    definition.id,
    definition,
  ])
)

export function getAgentContextProfileDefinition(
  profile: AgentContextProfile
): AgentContextProfileDefinition {
  const definition = PROFILE_INDEX.get(profile)
  if (!definition) {
    throw new Error(`Unsupported context profile: ${profile}`)
  }
  return definition
}

export function getBoardExportLevelForProfile(
  profile: AgentContextProfile
): BoardExportLevel {
  return getAgentContextProfileDefinition(profile).level
}

export function listAgentContextProfiles(
  source?: BoardExportSource
): AgentContextProfileDefinition[] {
  if (source === 'current-board') {
    return AGENT_CONTEXT_PROFILE_DEFINITIONS.filter(
      (definition) => definition.source !== 'snapshot'
    )
  }

  if (source === 'snapshot') {
    const priorityIds: AgentContextProfile[] = [
      'agent-snapshot',
      'human-summary',
    ]
    const prioritized = priorityIds
      .map((profile) => PROFILE_INDEX.get(profile))
      .filter((definition): definition is AgentContextProfileDefinition =>
        Boolean(definition)
      )
    const rest = AGENT_CONTEXT_PROFILE_DEFINITIONS.filter(
      (definition) =>
        definition.source !== 'current-board' &&
        !priorityIds.includes(definition.id)
    )
    return [...prioritized, ...rest]
  }

  return [...AGENT_CONTEXT_PROFILE_DEFINITIONS]
}

export function validateAgentContextProfileOptions(
  options: AgentContextProfileOptions
): string | null {
  const definition = getAgentContextProfileDefinition(options.profile)

  if (definition.source === 'snapshot' && options.source !== 'snapshot') {
    return `${definition.id} is only available for snapshot exports`
  }

  if (options.source === 'snapshot' && definition.source === 'current-board') {
    return `${definition.id} is only available for current board exports`
  }

  if (definition.requiresRecord && !options.recordId) {
    return `${definition.id} requires a recordId`
  }

  if (definition.requiresSprint) {
    const sprintTag = options.sprintTag ?? inferSingleSprintTag(options.filters)
    if (!sprintTag) {
      return `${definition.id} requires a sprintTag`
    }
  }

  return null
}

function inferSingleSprintTag(
  filters: BoardCurrentQuery | undefined
): string | undefined {
  const sprintTags = (filters?.tags ?? []).filter((tag) =>
    tag.startsWith('sprint:')
  )
  return sprintTags.length === 1 ? sprintTags[0] : undefined
}
