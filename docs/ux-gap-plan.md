# UX 差距计划（对标 Linear / Jira）

> 分支：`ux/linear-polish` · 更新：2026-08-11
> 目标：逐步缩小与 Linear/Jira 的体验差距。A（review should-fix）、B（Web Guidelines 剩余项）已在 2026-08-11 完成；C 组按本表推进。

## C 组差距项

| # | 差距项 | 现状 | 计划 | 状态 |
|---|---|---|---|---|
| C1 | IssuesPanel 独立视图 | 被动常驻底部，无独立入口 | sidebar"问题"打开独立 drawer（复用 IssuesPanel） | ✅ 2026-08-11 完成 |
| C2 | 看板统计/密度 | 列头只有计数 | 列头加聚合元信息（优先级分布、负责人头像堆叠） | ⬜ 待排期 |
| C3 | 批量操作 | 无多选 | 列表/看板多选 + 批量改状态/归档（需确认破坏性操作确认流） | ⬜ 待排期 |
| C4 | 键盘快捷键体系 | 只有 Cmd+K | N 新建 / B 看板 / L 列表 / ? 帮助面板 | ✅ 2026-08-11 完成 |
| C5 | 列表视图增强 | 简单堆叠卡片 | Linear 式表格视图：列排序、紧凑密度、内联编辑 | ⬜ 待排期 |
| C6 | 空态/首次引导 | 有 EmptyState | 首次使用引导（创建第一条记录提示、示例数据） | ⬜ 待排期 |

## 已完成的 A/B 组

### A 组（review should-fix，2026-08-11）

- A1 CommandPalette Enter 加 `isComposing` 检查（中文 IME 防误触）
- A2 CommandPalette activeIndex 结果集变化时 clamp
- A3 ProfileManagerDrawer 常驻渲染后表单重置（key remount）
- A4 CreateRecordDrawer 关闭动画（父组件条件渲染移除，改 key remount）
- A5 AppSettingsDrawer tablist roving tabindex（焦点跟随方向键）

### B 组（Web Interface Guidelines 剩余项，2026-08-11）

- B1 AnimatedDrawer + BoardStatusDropColumn 加 `overscroll-behavior: contain`
- B2 BoardCurrentPage 加 skip link 到 main（`#main-content`）
- B3 list view + SnapshotDrawer 大列表用 `content-visibility: auto`（含 contain-intrinsic-size）
- B4 ProfileManagerDrawer 搜索框补 aria-label
- B5 `transition` 全属性类统一改 `transition-colors`（含 `hover:shadow` 的行保留原 transition）
- B6 复制反馈按钮补 `aria-live="polite"`（ProfileManager / SuggestionActions / MetaPanel / ManualResponse）

## 验收口径（C 组完成后）

- C1/C4 已在浏览器实测（Issues drawer 打开、N/B/L/? 快捷键触发）
- typecheck / lint / build / devcheck 全绿
