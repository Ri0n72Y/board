import { describe, expect, it } from 'vitest'
import { AgentSkillService, SkillNotFoundError } from './agentSkillService.js'

function createService(): AgentSkillService {
  return new AgentSkillService()
}

describe('AgentSkillService', () => {
  // ─── List ───

  it('list includes labourboard-advisor', async () => {
    const svc = createService()
    const skills = await svc.listSkills()
    expect(skills.length).toBeGreaterThanOrEqual(1)
    const advisor = skills.find((s) => s.id === 'labourboard-advisor')
    expect(advisor).toBeDefined()
  })

  it('list summary has non-empty 64-char contentHash', async () => {
    const svc = createService()
    const skills = await svc.listSkills()
    for (const s of skills) {
      expect(s.contentHash).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it('list summary does not include markdown', async () => {
    const svc = createService()
    const skills = await svc.listSkills()
    for (const s of skills) {
      expect((s as Record<string, unknown>).markdown).toBeUndefined()
    }
  })

  it('list response has logical path not absolute', async () => {
    const svc = createService()
    const skills = await svc.listSkills()
    for (const s of skills) {
      // Logical path should not be an absolute file path
      expect(s.path).not.toMatch(/^[A-Z]:\\/)
      expect(s.path).not.toMatch(/^\//)
      // Should be in "built-in:..." format
      expect(s.path).toMatch(/^built-in:/)
    }
  })

  // ─── Detail ───

  it('detail includes markdown', async () => {
    const svc = createService()
    const skill = await svc.getSkill('labourboard-advisor')
    expect(skill).not.toBeNull()
    expect(skill!.markdown).toBeTruthy()
    expect(typeof skill!.markdown).toBe('string')
  })

  it('detail hash matches list hash', async () => {
    const svc = createService()
    const skills = await svc.listSkills()
    const listAdvisor = skills.find((s) => s.id === 'labourboard-advisor')!
    const detail = (await svc.getSkill('labourboard-advisor'))!
    expect(detail.contentHash).toBe(listAdvisor.contentHash)
  })

  it('detail contentHash is non-empty', async () => {
    const svc = createService()
    const detail = await svc.getSkill('labourboard-advisor')
    expect(detail!.contentHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('detail path is logical', async () => {
    const svc = createService()
    const detail = await svc.getSkill('labourboard-advisor')
    expect(detail!.path).toMatch(/^built-in:/)
  })

  it('missing skill returns null', async () => {
    const svc = createService()
    const skill = await svc.getSkill('nonexistent')
    expect(skill).toBeNull()
  })

  // ─── Snapshot ───

  it('snapshot includes markdown, hash, logical path', async () => {
    const svc = createService()
    const snap = await svc.getSkillSnapshot('labourboard-advisor')
    expect(snap).not.toBeNull()
    expect(snap!.markdown).toBeTruthy()
    expect(snap!.contentHash).toMatch(/^[a-f0-9]{64}$/)
    expect(snap!.path).toMatch(/^built-in:/)
    expect(snap!.source).toBe('built-in')
  })

  it('snapshot hash equals detail hash', async () => {
    const svc = createService()
    const snap = (await svc.getSkillSnapshot('labourboard-advisor'))!
    const detail = (await svc.getSkill('labourboard-advisor'))!
    expect(snap.contentHash).toBe(detail.contentHash)
  })

  // ─── resolveSkillSnapshots ───

  it('no skillIds returns only labourboard-advisor', async () => {
    const svc = createService()
    const snaps = await svc.resolveSkillSnapshots()
    expect(snaps.length).toBe(1)
    expect(snaps[0].id).toBe('labourboard-advisor')
  })

  it('skillIds includes labourboard-advisor does not duplicate', async () => {
    const svc = createService()
    const snaps = await svc.resolveSkillSnapshots([
      'labourboard-advisor',
    ])
    expect(snaps.length).toBe(1)
    expect(snaps[0].id).toBe('labourboard-advisor')
  })

  it('unknown skillId throws SkillNotFoundError', async () => {
    const svc = createService()
    await expect(
      svc.resolveSkillSnapshots(['missing-skill']),
    ).rejects.toThrow(SkillNotFoundError)
  })

  it('duplicate skillIds dedupe', async () => {
    const svc = createService()
    const snaps = await svc.resolveSkillSnapshots([
      'labourboard-advisor',
      'labourboard-advisor',
    ])
    expect(snaps.length).toBe(1)
  })

  it('snapshots preserve order with labourboard-advisor first', async () => {
    const svc = createService()
    const snaps = await svc.resolveSkillSnapshots()
    expect(snaps[0].id).toBe('labourboard-advisor')
  })

  it('empty string skillId throws SkillNotFoundError', async () => {
    const svc = createService()
    await expect(
      svc.resolveSkillSnapshots(['']),
    ).rejects.toThrow(SkillNotFoundError)
  })

  // ─── No absolute path leakage ───

  it('no absolute file path in snapshots', async () => {
    const svc = createService()
    const snaps = await svc.resolveSkillSnapshots()
    for (const s of snaps) {
      expect(s.path).not.toMatch(/^[A-Z]:\\/)
      expect(s.path).not.toMatch(/^\//)
      expect(s.path).toMatch(/^built-in:/)
    }
  })
})
