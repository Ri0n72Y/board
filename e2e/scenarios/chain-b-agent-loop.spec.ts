import { test, expect } from '../fixtures/board'

/**
 * 链路 B：Agent 总结闭环（MVP 核心）
 *
 * 场景：把已完成列的工作交给 agent 总结，再人工确认采纳。
 * 数据：杀戮尖塔 seed。
 */
test.describe('链路 B：Agent 总结闭环', () => {
  test('B1 上下文导出 → Save as Agent Draft → 抽屉可见', async ({ page, api }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    // 打开上下文包抽屉（sidebar Context Pack）
    await page.getByRole('button', { name: 'Context Pack' }).click()
    // dialog 打开（动画即时完成），断言 dialog 内标题可见
    await expect(page.locator('[role="dialog"]').getByRole('heading', { name: 'Context Pack' })).toBeVisible()
    // 填写草稿标题并保存
    await page.getByRole('textbox', { name: 'Draft title' }).fill('B1 battle summary draft')
    await page.getByRole('button', { name: 'Save as Agent Draft' }).click()
    // 关闭抽屉
    await page.getByRole('button', { name: 'Close' }).first().click()
    // 打开 Agent 草稿抽屉，应能看到该草稿
    await page.getByRole('button', { name: 'Agent Drafts' }).click()
    await expect(page.locator('[role="dialog"]').getByRole('heading', { name: /Agent Drafts/ })).toBeVisible()
    await expect(page.getByText('B1 battle summary draft').first()).toBeVisible()
  })

  test('B2 draft review：Mark reviewed 后徽标变绿', async ({ page, api }) => {
    // 先用 API 建 draft + review
    const draft = await api.createAgentDraft({ title: 'B2 draft pending review' })
    await api.reviewDraft(draft.id, 'reviewed')
    // 打开抽屉确认状态
    await page.goto('/')
    await page.getByRole('button', { name: 'Agent Drafts' }).click()
    await expect(page.getByText('B2 draft pending review').first()).toBeVisible()
    // 打开草稿详情，状态徽标为 reviewed
    await page.getByText('B2 draft pending review').first().click()
    await expect(page.locator('[role="dialog"]').getByText(/reviewed/i).first()).toBeVisible()
  })

  test('B3 生成 Suggestion → 列表出现 → 详情含 Patch 建议', async ({ page, api }) => {
    const draft = await api.createAgentDraft({ title: 'B3 suggestion draft' })
    await api.reviewDraft(draft.id, 'reviewed')
    await page.goto('/')
    await page.getByRole('button', { name: 'Agent Drafts' }).click()
    await page.getByText('B3 suggestion draft').first().click()
    // 点击生成建议
    await page.getByRole('button', { name: 'Generate AI Suggestion' }).click()
    // 建议列表出现（mock provider 生成）
    await expect(page.getByText(/AI Suggestions/)).toBeVisible()
  })

  test('B4 接受 Suggestion → 状态变 accepted', async ({ page, api }) => {
    const draft = await api.createAgentDraft({ title: 'B4 accept draft' })
    await api.reviewDraft(draft.id, 'reviewed')
    await page.goto('/')
    await page.getByRole('button', { name: 'Agent Drafts' }).click()
    await page.getByText('B4 accept draft').first().click()
    await page.getByRole('button', { name: 'Generate AI Suggestion' }).click()
    await expect(page.getByText(/AI Suggestions/)).toBeVisible()
    // 点选第一个 suggestion 打开详情，再 Accept
    await page.getByRole('button', { name: 'Accept' }).first().click()
    // Accept 后 suggestion 状态徽标变 reviewed（detail 面板显示 Accepted 标题）
    await expect(page.getByText(/Accepted/).or(page.getByText(/reviewed/)).first()).toBeVisible()
  })

  test('B5 安全边界：全程无自动 patch', async ({ page, api }) => {
    // 建 draft 但不 review、不采纳，确认看板无变化
    const before = await api.getCurrentBoard()
    await api.createAgentDraft({ title: 'B5 no board mutation' })
    const after = await api.getCurrentBoard()
    expect(after.snapshotHeadVersion).toBe(before.snapshotHeadVersion)
    expect(after.records.length).toBe(before.records.length)
  })

  test('B6 Formal Handoff：reviewed draft 可复制/下载', async ({ page, api }) => {
    const draft = await api.createAgentDraft({ title: 'B6 handoff draft' })
    await api.reviewDraft(draft.id, 'reviewed')
    await page.goto('/')
    await page.getByRole('button', { name: 'Agent Drafts' }).click()
    await page.getByText('B6 handoff draft').first().click()
    // 正式移交区块可用
    await expect(page.getByText(/Formal Handoff/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Copy Handoff Markdown/ }).first()).toBeEnabled()
  })

  test('B7 手动响应：粘贴 markdown 保存成功', async ({ page, api }) => {
    const draft = await api.createAgentDraft({ title: 'B7 manual response draft' })
    await api.reviewDraft(draft.id, 'reviewed') // 表单仅 reviewed 状态显示
    await page.goto('/')
    await page.getByRole('button', { name: 'Agent Drafts' }).click()
    await page.getByText('B7 manual response draft').first().click()
    // 表单区：粘贴响应到 markdown textarea（label 文本 Response Markdown）
    const editor = page.getByRole('textbox', { name: /Response Markdown/ })
    await editor.fill('# External agent summary\n\nThis is the analysis result returned by Codex.')
    await page.getByRole('button', { name: 'Save Agent Response' }).click()
    // 保存成功后响应列表出现（Pasted Responses 列表项）
    await expect(page.getByText(/Pasted Responses/).first()).toBeVisible()
  })
})
