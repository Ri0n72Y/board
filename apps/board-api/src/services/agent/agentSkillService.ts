import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join, resolve, sep, normalize } from 'node:path'
import type {
  AgentSkillDetail,
  AgentSkillSnapshot,
  AgentSkillSummary,
} from '@labour-board/shared'

const SKILLS_BASE_DIR = resolve(
  join(import.meta.dirname, '..', '..', '..', 'config', 'skills')
)

const BUILT_IN_SKILL_ID = 'labourboard-advisor'

interface SkillManifest {
  id: string
  name: string
  description: string
  /** Absolute filesystem path for reading. Never exposed via API. */
  fsPath: string
  /** Logical path exposed via API (e.g. "built-in:labourboard-advisor/SKILL.md"). */
  logicalPath: string
}

const BUILT_IN_SKILLS: SkillManifest[] = [
  {
    id: BUILT_IN_SKILL_ID,
    name: 'LabourBoard Advisor',
    description:
      'Built-in product skill for LabourBoard analysis. Provides context interpretation, board diagnosis, risk assessment, and action recommendations. Always enabled by default.',
    fsPath: join(SKILLS_BASE_DIR, 'labourboard-advisor', 'SKILL.md'),
    logicalPath: 'built-in:labourboard-advisor/SKILL.md',
  },
]

interface LoadedSkill {
  markdown: string
  contentHash: string
}

export class AgentSkillService {
  private skillCache = new Map<string, LoadedSkill>()

  async listSkills(): Promise<AgentSkillSummary[]> {
    const summaries: AgentSkillSummary[] = []
    for (const m of BUILT_IN_SKILLS) {
      const loaded = await this.loadSkillMarkdown(m.fsPath)
      if (!loaded) continue
      summaries.push({
        id: m.id,
        name: m.name,
        description: m.description,
        source: 'built-in',
        path: m.logicalPath,
        contentHash: loaded.contentHash,
      })
    }
    return summaries
  }

  async getSkill(skillId: string): Promise<AgentSkillDetail | null> {
    const manifest = BUILT_IN_SKILLS.find((m) => m.id === skillId)
    if (!manifest) return null

    this.validatePath(manifest.fsPath)

    const loaded = await this.loadSkillMarkdown(manifest.fsPath)
    if (!loaded) return null

    return {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      source: 'built-in',
      path: manifest.logicalPath,
      contentHash: loaded.contentHash,
      markdown: loaded.markdown,
    }
  }

  async getSkillSnapshot(skillId: string): Promise<AgentSkillSnapshot | null> {
    const manifest = BUILT_IN_SKILLS.find((m) => m.id === skillId)
    if (!manifest) return null

    this.validatePath(manifest.fsPath)

    const loaded = await this.loadSkillMarkdown(manifest.fsPath)
    if (!loaded) return null

    return {
      id: manifest.id,
      name: manifest.name,
      source: 'built-in',
      path: manifest.logicalPath,
      contentHash: loaded.contentHash,
      markdown: loaded.markdown,
    }
  }

  /**
   * Resolve and validate skill IDs, returning snapshots.
   * labourboard-advisor is always included first.
   * Unknown skillIds cause a SkillNotFoundError.
   * Duplicate skillIds are deduplicated.
   */
  async resolveSkillSnapshots(
    skillIds?: string[]
  ): Promise<AgentSkillSnapshot[]> {
    const normalized: string[] = []

    // LabourBoard advisor always first
    normalized.push(BUILT_IN_SKILL_ID)

    // Append user-provided ids, deduplicating
    if (skillIds && skillIds.length > 0) {
      for (const raw of skillIds) {
        if (typeof raw !== 'string') {
          throw new SkillNotFoundError(
            'each skillId must be a non-empty string'
          )
        }
        const trimmed = raw.trim()
        if (trimmed.length === 0) {
          throw new SkillNotFoundError('skillId must not be empty')
        }
        if (normalized.includes(trimmed)) continue
        normalized.push(trimmed)
      }
    }

    // Validate every id exists
    for (const id of normalized) {
      if (!BUILT_IN_SKILLS.some((m) => m.id === id)) {
        throw new SkillNotFoundError(`Unknown skill ID: ${id}`)
      }
    }

    const snapshots: AgentSkillSnapshot[] = []
    for (const id of normalized) {
      const snapshot = await this.getSkillSnapshot(id)
      if (snapshot) snapshots.push(snapshot)
    }

    return snapshots
  }

  private async loadSkillMarkdown(fsPath: string): Promise<LoadedSkill | null> {
    const cached = this.skillCache.get(fsPath)
    if (cached) return cached

    try {
      const markdown = await readFile(fsPath, 'utf-8')
      const contentHash = createHash('sha256').update(markdown).digest('hex')
      const result = { markdown, contentHash }
      this.skillCache.set(fsPath, result)
      return result
    } catch {
      return null
    }
  }

  /**
   * Prevent path traversal: ensure the resolved path is within SKILLS_BASE_DIR.
   */
  private validatePath(filePath: string): void {
    const normalized = normalize(resolve(filePath))
    const normalizedBase = normalize(SKILLS_BASE_DIR)

    if (
      !normalized.startsWith(normalizedBase + sep) &&
      normalized !== normalizedBase
    ) {
      throw new SkillPathTraversalError(
        `Skill path traversal rejected: ${filePath}`
      )
    }
  }
}

export class SkillNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillNotFoundError'
  }
}

export class SkillPathTraversalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SkillPathTraversalError'
  }
}
