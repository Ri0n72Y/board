import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join, resolve, sep, normalize } from 'node:path'
import type {
  AgentSkillDetail,
  AgentSkillSnapshot,
  AgentSkillSummary,
} from '@labour-board/shared'

const SKILLS_BASE_DIR = resolve(
  join(import.meta.dirname, '..', '..', '..', 'config', 'skills'),
)

const BUILT_IN_SKILL_ID = 'labourboard-advisor'

interface SkillManifest {
  id: string
  name: string
  description: string
  path: string
}

const BUILT_IN_SKILLS: SkillManifest[] = [
  {
    id: BUILT_IN_SKILL_ID,
    name: 'LabourBoard Advisor',
    description:
      'Built-in product skill for LabourBoard analysis. Provides context interpretation, board diagnosis, risk assessment, and action recommendations. Always enabled by default.',
    path: join(SKILLS_BASE_DIR, 'labourboard-advisor', 'SKILL.md'),
  },
]

export class AgentSkillService {
  private skillCache = new Map<string, { markdown: string; contentHash: string }>()

  async listSkills(): Promise<AgentSkillSummary[]> {
    return BUILT_IN_SKILLS.map((m) => this.toSummary(m))
  }

  async getSkill(skillId: string): Promise<AgentSkillDetail | null> {
    const manifest = BUILT_IN_SKILLS.find((m) => m.id === skillId)
    if (!manifest) return null

    this.validatePath(manifest.path)

    const loaded = await this.loadSkillMarkdown(manifest.path)
    if (!loaded) return null

    return {
      ...this.toSummary(manifest),
      markdown: loaded.markdown,
    }
  }

  async getSkillSnapshot(skillId: string): Promise<AgentSkillSnapshot | null> {
    const manifest = BUILT_IN_SKILLS.find((m) => m.id === skillId)
    if (!manifest) return null

    this.validatePath(manifest.path)

    const loaded = await this.loadSkillMarkdown(manifest.path)
    if (!loaded) return null

    return {
      id: manifest.id,
      name: manifest.name,
      source: 'built-in',
      path: manifest.path,
      contentHash: loaded.contentHash,
      markdown: loaded.markdown,
    }
  }

  async loadBuiltInSkillSnapshots(skillIds?: string[]): Promise<AgentSkillSnapshot[]> {
    const ids = skillIds && skillIds.length > 0 ? skillIds : [BUILT_IN_SKILL_ID]

    // Always include labourboard-advisor first
    const ordered = [
      BUILT_IN_SKILL_ID,
      ...ids.filter((id) => id !== BUILT_IN_SKILL_ID),
    ]

    const snapshots: AgentSkillSnapshot[] = []

    for (const id of ordered) {
      // Only load skills that exist in BUILT_IN_SKILLS
      if (!BUILT_IN_SKILLS.some((m) => m.id === id)) continue
      const snapshot = await this.getSkillSnapshot(id)
      if (snapshot) snapshots.push(snapshot)
    }

    return snapshots
  }

  private toSummary(manifest: SkillManifest): AgentSkillSummary {
    return {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      source: 'built-in',
      path: manifest.path,
      contentHash: '',
      // contentHash is populated from the cache; empty here is fine for list
    }
  }

  private async loadSkillMarkdown(filePath: string): Promise<{ markdown: string; contentHash: string } | null> {
    const cached = this.skillCache.get(filePath)
    if (cached) return cached

    try {
      const markdown = await readFile(filePath, 'utf-8')
      const contentHash = createHash('sha256').update(markdown).digest('hex')
      const result = { markdown, contentHash }
      this.skillCache.set(filePath, result)
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

    if (!normalized.startsWith(normalizedBase + sep) && normalized !== normalizedBase) {
      throw new SkillPathTraversalError(
        `Skill path traversal rejected: ${filePath}`,
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
