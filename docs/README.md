# LabourBoard 项目文档

本文档随代码维护（见 `AGENTS.md` "文档随代码维护"规则）：**改动任一模块时，必须同步更新本目录下对应文档与图**。所有图使用 mermaid 格式，可在 GitHub 直接渲染。

## 目录

### 架构总览（`architecture/`）

| 文档 | 内容 |
| --- | --- |
| [c4.md](architecture/c4.md) | C4 图：Context（系统上下文）→ Container（容器）→ Component（组件） |
| [dataflow.md](architecture/dataflow.md) | 关键数据流图：记录保存、快照、agent 建议（只读）、看板加载/导出 |

### 模块文档（`modules/`）

| 文档 | 对应代码 | 内容 |
| --- | --- | --- |
| [board-api.md](modules/board-api.md) | `apps/board-api/src/` | 后端：routes / services / repositories / db / config，含 UML 与组件图 |
| [board-web.md](modules/board-web.md) | `apps/board-web/src/` | 前端：stores / hooks / api / pages / components 分层 |
| [shared.md](modules/shared.md) | `packages/shared/src/` | 共享契约包：interfaces / constants / utils，含核心 UML |

### 历史交付文档

- `apps/board-api/docs/`：API 契约（`api-contract.md`）、后端基线（`backend-baseline.md`）、board-current 投影说明、closure 报告等（随 API 演进维护）
- `docs/p5-dnd-status-move-prd.md`：P5 拖拽状态移动 PRD（历史记录）

## 维护规则

1. **改动即同步**：新增/修改路由、service、store、接口类型时，同步更新对应模块文档与架构图。
2. **图表用 mermaid**：C4 用 `C4Context` / `C4Container` / `C4Component`，UML 用 `classDiagram`，流程用 `flowchart` / `sequenceDiagram`。
3. **图与代码一致**：图中出现的类/函数/端点名称必须与代码实际符号一致；重构后图失效即视为文档过期。
4. **PR 自检**：PR 模板含"文档同步"检查项，改动涉及文档化模块时必须勾选并说明。

## 快速上手

```bash
pnpm install                     # 安装依赖
pnpm --filter @labour-board/shared build   # 先构建共享包（typecheck 依赖）
pnpm dev                         # 同时启动 API(8787) + Web dev server
```
