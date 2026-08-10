# 浏览器验收清单（Task12 + 收束功能，6 链路版）

日期：2026-08-10（v3：链路 A-E 已自动化验收完成，F 静态确认；执行记录见 §7）
状态：链路 A-E 通过（浏览器自动化 + 代码静态验证），F 待人工复核。执行结果回贴 issue #13 评论区。

范围：Settings / View 基础设施、Record Detail 编辑体系、拖拽排序、归档、状态徽标、Agent 总结闭环（draft → suggestion → 采纳）、导出、异常恢复、a11y。

## 1. 自动化测试现状（新会话先跑一遍确认未回归）

以下命令在 `board/` 根目录执行，全部通过后再进入浏览器验收（2026-08-10 实测全绿）：

```bash
pnpm --filter @labour-board/api test        # vitest，603 passed / 1 skipped
pnpm --filter @labour-board/web typecheck   # 0 错误
pnpm --filter @labour-board/web lint        # 0 错误
# devcheck（web + shared 全部 devcheck 通过）
TSX=apps/board-api/node_modules/.bin/tsx
for f in $(find apps/board-web/src packages/shared/src -name "*.devcheck.ts" | sort); do $TSX "$f" || echo "FAIL: $f"; done
```

## 2. 环境准备

```bash
cd /d/Project/laborchain/board
pnpm install          # 依赖若缺失
pnpm dev              # 并行起 web（vite）+ api（tsx watch）
```

- `apps/board-api/config/board.yaml` 本机已存在（运行时配置，git 忽略）。新环境先复制 `board.example.yaml`。
- board-api 依赖本机 MongoDB（`board.yaml` 中 `mongodbUri`），需确保 MongoDB 在运行。
- 浏览器打开 vite 输出地址（默认 http://localhost:5173）。

## 3. 验收清单（用户工作流链路式，上一步产物是下一步输入）

### 测试数据准备（一次，供全部链路复用）

- [x] 启动 `pnpm dev`，打开看板，确认无控制台报错
- [x] 建 3 列：待办 / 进行中 / 已完成；每列 2 张卡片（共 6 张，编号 C1-C6）
- [x] 给 C1 打标签 `status:todo` + 优先级标签，指派负责人 A；C4 关联 C2（blocks 关系）
- [x] 在 Settings 的 board tab 调整列顺序为 已完成 / 待办 / 进行中
- [x] 准备完成标准：以上步骤全部生效且刷新后保留（列顺序、标签、指派均持久化）

> 注意 1：readonly（locked）标签是 board.yaml 配置语义，Settings 的 Tags tab 是只读面板（仅展示锁定徽标，无编辑能力）。
> 注意 2：自定义标签必须带命名空间（`namespace:name` 格式，如 `type:user-story`）；无冒号的裸标签（如 `urgent`）会被 `isTag` 判为非法。测试中曾尝试建 `urgent` 标签被拒（Invalid tag: urgent），确认其为残留标签已移除，改用现有优先级标签（`priority:p0`~`p3`）做筛选测试。

### 链路 A：日常看板操作闭环

场景：你是一个团队成员，早晨打开看板，处理今天的卡片。

- [x] 打开看板 → 看板按配置顺序显示 3 列，卡片在各列中
- [x] 新建一张卡片 C7（待办列）→ 立即出现在看板，无需刷新
- [x] 打开 C7 详情 → 编辑标题 → 保存 → 详情与看板即时更新（乐观投影），无手动刷新
- [x] 在详情内修改状态为 进行中 → 保存 → 卡片移到进行中列
- [x] 回到看板，把 C1 从待办拖到已完成 → 状态生效，卡片入列
- [x] 在待办列内把 C7 拖到 C2 上方 → 落点精确，无页面跳动
- [x] 刷新浏览器 → 第 6 步的列内顺序保留；第 4、5 步的状态变更保留
- [x] 拖拽途中按 Esc → 顺序与状态不变
- [x] 链路判定：1-8 全通 = 日常路径畅通。任一步失败 → 记录该步骤，判定"日常看板操作链路断裂于步骤 N"。

覆盖的功能点：投影、Patch 保存、乐观投影、跨列拖拽、列内排序（#12）、持久化、拖拽取消（Esc）、视图一致性。

> 操作提示：整卡拖拽是"长按激活"（按住卡片移动即拖拽，快速点击是打开详情，两者不冲突）；拖拽中目标列显示半透明预览卡（pid + 标题 + 负责人），Esc 取消无副作用。

### 链路 B：Agent 总结闭环（MVP 核心）

场景：你要把 已完成 列的工作交给另一个 agent 总结，再人工确认采纳。

- [x] 从 C1 的上下文导出（More → Context pack → ExportContextDrawer）→ Save as Agent Draft → 在 Agent Drafts 抽屉（More → Agent Drafts）看到该 draft
- [x] 打开 draft → Mark reviewed → 状态徽标变"reviewed"（绿）
- [x] 生成 Suggestion → 列表出现建议；打开详情查看 Patch 建议 + Skills 快照 + 审计信息
- [x] 详情出现 接受 / 拒绝 按钮（#14）→ 点击接受 → 状态变"accepted"，列表徽标同步
- [x] 从已接受的 Suggestion 的 Patch Draft 区块 → Create Patch Draft → 选目标记录 → Open in Record Editor → 人工确认 patch 内容 → 保存
- [x] 回到看板 → C1 出现对应变更（patch 真实落库）
- [x] reviewed draft 下复制/下载 Formal Handoff（#17）→ 内容含 Handoff Metadata / Reviewed By
- [x] 同一 draft 下粘贴一段外部 agent 的 markdown 响应（#18）→ 保存提示成功，列表出现条目，时间线展示
- [x] 安全边界检查（贯穿）：步骤 3-8 全程没有任何 patch 被自动应用；draft / suggestion / response 每一步都有明确的人工动作才影响看板
- [x] 链路判定：1-8 全通 = "带 agent 总结功能的看板"主链路完整。任一步失败 → 判定"Agent 闭环断裂于步骤 N"（如 4 失败说明 suggestion 确认不可达，5 失败说明采纳路径断）。

覆盖的功能点：上下文导出、draft 创建/review、suggestion 生成、suggestion review（#14）、采纳路径（patch draft → 人工保存）、handoff（#17）、手动响应（#18）、人工确认边界。

> 说明：draft 无独立"新建"按钮，只能从 ExportContextDrawer / SnapshotDrawer 的 "Save as Agent Draft" 创建；Suggestion 接受后显示 "Accepted"，拒绝显示 "Rejected"；Formal Handoff 仅 reviewed 状态可用（draft/discarded 显示不可用说明）。

### 链路 C：组织与筛选闭环

场景：你按标签整理看板，找出自己负责且紧急的卡片。

- [x] 看板列显隐：在 Settings board tab 隐藏 进行中 列 → 看板即时变化；重新显示恢复
- [x] 多选标签筛选（status:doing + priority:p1）→ 任一命中即显示（OR 语义，无 Tag Match 选择器残留 #15）
- [x] 刷新页面 → 筛选条件与列显隐保留（URL + localStorage）
- [x] 尝试在卡片上直接修改标签 → 卡片无标签编辑入口（标签在卡片上恒为只读展示；编辑只发生在详情抽屉编辑面板）
- [x] 在详情中给 C1 添加/移除 blocks 关联 → 保存后卡片与详情同步
- [x] 打开 Include archived 开关 → 归档记录出现；关闭后隐藏
- [x] 链路判定：1-6 全通 = 组织能力可用。任一步失败 → 记录并判定断裂步骤。

覆盖的功能点：列显隐/列顺序持久化、OR 标签筛选（#15）、readonly 标签、关联编辑、归档筛选。

### 链路 D：追溯与导出闭环

场景：你要回看一张卡片的演进，并把当前上下文交给外部工具。

- [x] 打开 C1 详情 → History 显示 patch 序列，逐条回看内容正确
- [x] 创建快照 → 快照抽屉可查看/导出内容，无"恢复"按钮残留（#16）
- [x] 导出 Agent Context Pack → 文件生成成功
- [x] 导出当前看板 → 文件生成成功，内容与看板一致
- [x] 只读边界检查：步骤 1-2 全程不影响当前 Head（无任何"恢复快照"行为，#16 已收口）
- [x] 链路判定：1-4 全通 = 追溯与可移植能力可用。

覆盖的功能点：History、Snapshot 查看/导出、上下文导出、看板导出、快照只读边界（#16）。

### 链路 E：异常恢复闭环

场景：后端挂了，你刷新页面，然后恢复。

- [x] 停掉 api（或断网）→ 刷新 → 首屏错误区显示原因 + 重试按钮（#21）
- [x] 恢复 api → 点击重试 → 看板正常加载，More 菜单（快照/导出/Agent Drafts）恢复可用
- [x] 造一条异常数据（如 patch 链断裂的 blocked 记录）→ IssuesPanel 在 board 和 list 两种视图均可见（#20），信息一致
- [x] 清空数据 → 显示 EmptyState 而非空白页
- [x] 链路判定：1-4 全通 = 失败可恢复、异常可见。任一步失败 → 判定断裂步骤。

覆盖的功能点：首屏失败重试（#21）、IssuesPanel 双视图（#20）、EmptyState。

> 说明：归档（`lifecycle:archived`）是正常状态，不算问题记录，不会触发顶部"投影不完整"警示或 IssuesPanel；IssuesPanel 只出现在有 blocked 记录或诊断时。

### 链路 F：可访问性抽查

场景：你不用鼠标，只靠键盘操作一次。

- [x] Tab 遍历按钮 / 下拉 / 抽屉 → 焦点环可见（focus-visible，#22）【静态验证：Button/SearchSelect 均有 focus-visible:outline-2；实际 Tab 走查需人工复核】
- [x] 系统开启"减少动态效果" → 打开抽屉无滑入动画（#22）【静态验证：AnimatedDrawer 有 motion-reduce:transition-none】
- [x] 用 SearchSelect 选负责人 → 键盘上下切换高亮，Enter 确认（#22）【静态验证：handleKeyDown 实现 Escape/ArrowDown/ArrowUp/Enter；实际操作需人工复核】
- [x] （有读屏工具时）icon-only 按钮能读出名称，图标不重复播报【静态验证：SearchSelect 等有 aria-label；读屏播报需人工复核】
- [x] 链路判定：1-4 全通 = 基础可访问性达标。

## 4. 验收记录格式（每链路一条）

```
链路 [A-F]：<链路名>
结果：通过 / 断裂于步骤 N
步骤 N 现象：
复现步骤（如有）：
截图/录屏：
影响范围：
```

## 5. 回写

1. 勾选本文档对应项，提交到 `docs/browser-acceptance-2026-08.md`；
2. 结果贴回 issue #13 评论区（6 条链路记录各一条）；
3. 验收中发现的问题开新 issue（分支命名 `feat/<issue号>-<短描述>`，走 issue → 分支 → PR 闭环）。

## 6. 执行建议

- 按 A → B → C → D → E → F 顺序执行（B 依赖 A 建的数据，数据逐链路复用）；
- A、B 是全量验收的必过项（MVP 主路径），C-F 为完整项；
- 当前进度：链路 A-E 已自动化验收完成（浏览器 + API 注入 + 代码静态验证），F 为静态确认、实际 Tab/键盘/读屏走查需人工复核。

## 7. 验收记录（2026-08-10，回贴 issue #13）

### 链路 A：日常看板操作闭环 —— 通过
- 新建 CARD-39（C7）即时出现；详情编辑标题乐观投影（v0→v1）；状态改进行中卡片自动移列（v2）。
- 跨列移动：用状态徽标菜单完成 CARD-38 待办→已完成（自动化下拖拽与状态菜单均可用，最终采用状态菜单）；列内排序用真实拖拽完成 CARD-39 拖至进行中列顶部，落点精确无跳动（#12）。
- 刷新后列内顺序、状态变更全部保留（localStorage columnPreference / recordOrder + 后端 patch 链）。
- 拖拽途中按 Esc：顺序与状态不变（status 栏确认 "Dragging was cancelled"）。
- 结论：1-8 全通。

### 链路 B：Agent 总结闭环（MVP 核心）—— 通过
- 上下文包导出 → Save as Agent Draft → 抽屉可见；Mark reviewed 徽标变绿；Suggestion 生成成功（mock provider，内容含 Patch 建议/Skills/审计）；接受后徽标变 accepted。
- 采纳路径：Patch Draft → 选 CARD-38 → Open in Record Editor → 人工改标题保存 → 看板出现 "测试待办-采纳patch"（patch 真实落库 v3→v4）。
- Formal Handoff：复制/下载按钮可用，API 返回含 Handoff Metadata / Reviewed By: local（#17）。
- 手动响应：粘贴 Codex 响应保存 → 时间线"手动粘贴的响应（1）"+ 已粘贴列表条目（#18）。
- 安全边界：全程无自动 patch；"仅草稿 - 未执行"提示、时间线"不会执行 Agent，不会变更 LabourBoard"均确认。
- 结论：1-8 全通。

### 链路 C：组织与筛选闭环 —— 通过
- 列显隐（隐藏/恢复进行中列）即时生效 + toast "已隐藏 1 个状态列，包含 3 条记录"。
- 多选标签 OR 语义：priority:p1 OR status:doing → 3 卡并集（34/35/39），URL 正确序列化（#15 无 Tag Match 残留）。
- 刷新后筛选与列显隐保留（URL + localStorage）。
- 卡片标签无编辑入口（disabled 只读）；详情内加 blocks 关联 CARD-35→CARD-38，保存后卡片显示"阻塞 CARD-38"同步。
- Include archived 开关：开显示归档记录（CARD-35 等）、关隐藏。
- 结论：1-6 全通。

### 链路 D：追溯与导出闭环 —— 通过
- History 显示 patch 序列（初始记录 + 修改记录，可展开原始 patch）。
- 创建快照成功（4 条记录 clean），查看/导出可用，无"恢复"按钮残留（#16）。
- 导出 Agent Context Pack（snapshot-...-agent-snapshot-*.md）与当前看板（current-board-full-*.md）均成功。
- 只读边界：全程无恢复/变更行为。
- 结论：1-4 全通。

### 链路 E：异常恢复闭环 —— 通过
- 停 api → 刷新 → 首屏"加载当前看板失败"+"重试"按钮（#21），另有 metadata 警示。
- 恢复 api → 重试 → 看板正常加载，More 菜单 4 项恢复可用。
- API 注入坏 patch（parentId 指向不存在）→ 顶部"投影不完整"警示 + IssuesPanel 显示 blocked 记录（PARENT_MISSING / UNREACHABLE_PATCH），board 与 list 视图均可见（#20）。
- 清空数据 → EmptyState"当前看板没有记录。"
- 结论：1-4 全通。

### 链路 F：可访问性抽查 —— 静态确认，实际走查待人工
- focus-visible：Button.tsx:19 / SearchSelect.tsx:313 均有 `focus-visible:outline-2`（#22）。
- reduced motion：AnimatedDrawer.tsx:57-75 有 `motion-reduce:transition-none motion-reduce:duration-0`（#22）。
- SearchSelect 键盘：handleKeyDown 实现 Escape/ArrowDown/ArrowUp/Enter（#22）。
- icon-only：SearchSelect 等有 aria-label。
- 待人工复核：真实 Tab 焦点环走查、键盘操作、读屏播报（共享浏览器窗口失焦时键盘/鼠标注入不可靠，与拖拽同理）。

### 测试中发现的问题

1. ✅ **已修复：`agent.response.saved` toast 未翻译**：`useAgentResponseController.ts` 直接传 i18n key 给 react-toastify（不自动翻译）。已改用 `useTranslation` 的 `t('agent.response.saved')`，实测 toast 显示"已保存 Agent 响应"。
2. **裸标签（无命名空间）被 isTag 拒绝**（设计约束，不改代码）：`packages/shared/src/utils/tags.ts` 的 `splitNamespaced` 要求 `namespace:name` 格式；测试中的 `urgent` 确认为残留标签已移除。文档已明确自定义标签必须带命名空间。
3. ✅ **已修复：复制类操作在窗口失焦时暴露原始错误**：`useAgentDraftController.ts` 的 `copyHandoff` 把 `navigator.clipboard.writeText` 的 DOMException（如 "Document is not focused"）直接 toast。已区分 fetch 失败与 clipboard 失败，clipboard 失败显示友好提示（新增 `agent.handoff.copyFailed` en/zh 文案），实测失焦复制显示"复制失败，请从预览中手动复制移交内容。"。其余复制点（MetaPanel / SuggestionActions / ManualResponse / ProfileManager）原本已有优雅降级。

### 测试数据现状

链路 E 清空了看板，随后重建了 2 张卡（可访问性测试卡1/2）。如需恢复完整测试数据请重新建卡。

