# LabourBoard MVP 收束（MVP Scope）

> 本文基于已确认并实现的大部分内容，收束 LabourBoard 的 MVP 范围与当前状态（2026-08）。对照代码维护；与根目录 docs/PRD.md 12.4 保持一致。图与数据流见 `docs/architecture/`。

## 一、MVP 要验证什么

MVP 要验证的核心闭环：

```text
现实中的劳动 / 协作事实
        ↓
      Record
        ↓
通过 Patch 持续追加变化
        ↓
生成可用的 Current Projection
        ↓
团队在 Board / List 中组织、查看、修改
        ↓
保留 History 与 Snapshot
        ↓
导出 / 提供给 Agent 分析
        ↓
Agent 给出建议或 Draft
        ↓
人确认后形成新的 Patch
        ↓
继续实践
```

最终验证的问题：

> **一个小型协作团队，能否围绕一套可追溯的劳动事实进行日常协作，同时保留"现在是什么状态、为什么变成这样、谁确认了什么"的材料。**

重点是"事实材料可回顾、可争论、可迁移、可组织"。工时统计、绩效量化都不是当前核心。

## 二、MVP 的第一目标用户

> **小型协作团队，最初以 3～5 人左右的独立游戏团队作为具体使用场景。**

他们需要处理：工作事项、项目卡片、资产、责任人、状态、关联关系、工作变化、历史、阶段快照、Agent 辅助整理。

因此 LabourBoard 是 LabourChain 理论落到实际使用的第一层产品。

## 三、MVP 的核心事实模型

### Record

Record 是基本业务事实容器，例如 `Card`、`Asset`、`Transaction` / 其他业务 Record。

包含：

```text
id
pid
schema

tags
assignee

body

assets
relations
```

Record 保存一个现实对象的基础身份和初始事实。（代码：`packages/shared/src/interfaces/record.ts` 的 `RecordItem<TBody>`。）

## 四、Patch：MVP 最关键的数据机制

Record 后续修改通过追加 Patch 表达：

```text
Record
  |
  ├── Patch A
  |
  ├── Patch B
  |
  └── Patch C
```

Patch 包含：

```text
targetId
parentId
tagChanges
assignee
body
assets
relations
description
```

核心约束：

* **Append-only**：历史 Patch 不覆盖。
* **Parent chain**：通过 `parentId` 建立变化链（`Record → Patch A → Patch B → Patch C`）。
* **只记录变化部分**：例如只修改标题时，Patch body 只含 `{ "title": "new title" }`，无需重新保存完整 Record。

（代码：`packages/shared/src/interfaces/patch.ts` 的 `PatchItem`；`records` collection 同时存 base record 与 patch，以 `targetId` 是否存在区分。）

## 五、Current Projection

日常使用时，用户不应该自己读取 Patch 链。系统需要：

```text
Record
+
Patch chain
      ↓
Current Projection
```

MVP 必须同时存在两种视角：

```text
事实层：Record / Patch / Snapshot
使用层：Board Current / List Current / Record Detail
```

Current Projection 可以重新生成，它不应该反过来成为历史事实源。

## 六、History

用户必须能够回答：**这条 Record 是怎么变成现在这样的？**

Detail 中需要同时存在 `Details` 与 `History`，History 展示：

```text
Base Record
    ↓
Patch 1
    ↓
Patch 2
    ↓
Patch 3
```

已明确：编辑发生在 `RecordDetailDrawer`，History 自己不承担编辑职责；旧方案 `History -> Edit（EditRecordDrawer）` 已废弃。

## 七、Snapshot

* Patch History 回答"一条 Record 怎么变化"；
* Snapshot 回答"某个组织阶段，当时整体是什么状态"。

因此 MVP 需要 `Snapshot Head` 与 `Snapshot`。Snapshot Head 当前还承担 `version`、`lastPatchId` 这样的并发控制 / current head cache 功能（实现为 `snapshots` collection 中 `kind: 'snapshotHead'` 的文档）。

Snapshot 本身应该能够创建、查看、导出、回顾阶段状态；**历史 Snapshot 只用于回顾**，不能把历史 Snapshot 打开后影响现在的 Head。

## 八、并发与事实确认

MVP 不追求复杂多人协同算法。Record Patch 使用：

```text
GET head
 ↓
读取 currentVersion / parentId
 ↓
提交 Patch
 ↓
服务端验证
```

发生 stale head 时返回 **409 Conflict**，然后用户重新读取、重新判断、重新提交。即：**对事实修改使用明确的版本冲突**。

这一点和 Task15 的 View Preference 不同：View 排序采用 **Last Write Wins**，因为它只是组织视图。

## 九、Board

Board 是 MVP 最主要的日常操作界面：

```text
Todo     Doing     Done
 │         │         │
Card      Card      Card
Card      Card
```

列来源于 `status:*` tags。Board 需要支持：根据状态分列、卡片展示、Detail、Status DnD、Filter、列隐藏、列排序、卡片排序、当前状态即时更新。

## 十、View Preference

这是经过 Task12 / Task15 后明确出来的一层：**Board 的组织方式本身属于 View Preference，而不是 Record fact。**

```text
Board View
├── filter
├── visible columns
├── column order
└── record order
```

这些数据**不上链、不进入 Patch、不进入 Record History、不进入 Snapshot**。它表达"团队现在希望怎样看这些事实"。

（代码：column preference 存前端 localStorage，filter 存 URL query；无服务端存储路径。）

## 十一、Task12 在 MVP 中的位置

Task12 已完成：View 的 `visible columns`、`column order`，以及整个 Record Detail editing 体系，包括独立 Settings、Board / Tags / General、Column preference、Column reorder、Tag readonly、Status DnD、Detail inline editing、single active editor、dirty state、Patch save、optimistic projection、Relation 编辑、Agent → Human Save 边界。

Task12 解决的是：**MVP 的"当前状态如何被人可靠操作"这一层。**

## 十二、Task15 在 MVP 中的位置

Task15 补完 View 的 `record order`（列内人工排序），需要这种顺序能够持久保存，目标模型类似：

```ts
{
  columns: [
    {
      columnId: "todo",
      recordOrder: ["CARD-7", "CARD-2", "CARD-12"]
    }
  ]
}
```

同时改善 DnD 的插入位置（`CARD-A ── 插入位置 ── CARD-B`），避免大范围重新排列、页面跳动、不必要 refresh。

**Task15 仍然属于 MVP**：当前目标是让 Board 真正承担团队日常组织工作，一个 Kanban Board 连卡片人工顺序都无法稳定保留，会明显破坏实际使用。

✅ **Task15 已实现**（2026-08 收尾）：列内人工排序已落地（`apps/board-web/src/utils/boardRecordOrder.ts`，localStorage 持久化 `labourboard.boardView.recordOrder`），DnD 插入位置优化（插入指示线、避免大范围重排与页面跳动）。

## 十三、无 Status Record

Board 中的 Record 应具有 `status:*` tag。没有 status tag 的异常 Record **不自动建立 Uncategorized、不进入普通 Board**，由 List View 负责发现和管理。这也是 List View 在 MVP 中仍然有价值的原因之一。

## 十四、Relation / Asset

Record 不能只成为孤立任务卡，因此 MVP 需要基本关系能力：

```text
Record
 ├── assets
 └── relations
```

Relation：

```text
constraint
target
description
```

例如 `depends_on → CARD-1`、`produces → ASSET-4`、`related_to → CARD-7`。

Relation 是事实的一部分，其修改进入 Patch / History。与 Board 排序的边界：**Relation → 事实；Record order → View。**

## 十五、Profile / Assignee

MVP 需要最基础的成员身份，用于 assignee、创建者、确认者、UI 显示。

当前 MongoDB 数据范围（以代码为准）：

```text
事实层：records、snapshots、profiles
Agent 辅助：agent_drafts、agent_responses、agent_suggestions
```

> **注（2026-08 记录）**：增加 Agent 功能后 collection 从 3 个扩展到 6 个，其中 agent 相关 3 个主要用于存档（draft / suggestion / response 历史）。当前架构先保持现状，未来可评估是否收敛（如 agent 数据改内存 / 归档目录 / 独立库），暂不优化。

当前没有必要建立复杂组织 / RBAC / 权限数据库。

## 十六、配置与运行时状态管理

MVP 的配置与运行时状态采用分层管理（2026-08 确立）：

```text
Redis（运行时单一事实源）
 ├── board:config                完整 BoardConfig（含 pid 运行态）
 ├── board:pid:next:<prefix>     PID 原子计数器（INCR）
 └── board:pid:latest:<prefix>   PID 最新分配记录（hash）
        ↑ 导入 / 导出 ↓
YAML（board.example.yaml / board.yaml）
 └── 只承载静态配置：records / pid.prefixes / tags / status / priority
```

* **配置分层**：Redis 是配置的运行时单一事实源（`board:config`，含 PID 运行态 `nextNumber/latest`）；YAML 只做导出与可视化配置。AI 编辑 YAML 后经 `POST /api/v0/config/yaml` 导入，静态部分更新、PID 运行态保留；`GET /api/v0/config/yaml` 导出静态配置（剥离运行态）。
* **PID 分配原子化**：改用 Redis `INCR board:pid:next:<prefix>` 原子递增，替代原 YAML 文件写回（`boardConfigWriter` 已删除）——并发可靠、重启不丢；冲突路径用循环 INCR + `findByPid` 探测（跨进程安全）；启动 reconcile 用 Lua `SET-if-less` 原子校准计数器。
* **热更新**：`ConfigService` 原地 mutate 共享配置引用，`RecordService` / `PidAllocator` 立即生效（无需重启）；`POST /api/v0/config` 支持整体 JSON 更新（保留 pid 运行态）。
* **无 Redis 降级**：未配置 `REDIS_URL` 时回退内存 PID 分配（`memoryPidStore`），用于单进程开发与测试。
* **加载优先级**：有 Redis 且已有 config → 从 Redis 读；无 → 从 YAML 读并 seed 到 Redis；YAML 也无且 `BOARD_CONFIG_OPTIONAL=true` → 用默认配置 seed 并自举。

（代码：`apps/board-api/src/config/redisConfigStore.ts`、`services/pid/pidAllocator.ts`、`db/redis.ts`；API：`routes/config.ts`。）

## 十七、Agent

Agent 在 MVP 中的角色：

```text
事实 → Context → Agent → Suggestion / Draft → Human → Patch
```

Agent 可以：阅读当前 Board、阅读历史材料、获取 Context Pack、生成 Draft、给出 Patch 建议、提供 description、帮助打开需要修改的 Record。

Agent 当前不能：自动提交 Patch、自动修改 Record、绕开人工确认。**事实确认权仍在人。**

（代码：draft 必须 reviewed 才能 handoff / 生成 suggestion；不存在 patch apply 路由。）

## 十八、Export / Context Pack

MVP 还需要把事实移出系统：

* **Export**：将当前 Board / Snapshot 导出成人可读内容（Markdown）。
* **Context Pack**：将结构化事实整理为 Agent / 外部工具可以消费的上下文。

这承担了 LabourChain 很重要的一项验证：**劳动材料能不能脱离原来的 UI，继续被其他人或机器读取和利用。**

## 十九、当前 MVP 的"链"做到什么程度

长期 LabourChain 有：PoA、链、多节点、事实确认、repo 准入、链上协议。

但**当前 LabourBoard MVP 不接真实 LabourChain 节点**。当前只实现协议形状：

```text
Record → Patch → Patch → Patch
parentId / version / append-only history / snapshot / projection
```

当前不实现：真正区块链节点、链上签名、共识、节点同步、协议哈希、多节点 PoA 网络。

因此当前 MVP 可以看作：

> **先验证 LabourChain 的事实模型和协作模型，再验证分布式执行。**

未来 PoA / 链节点可以接在稳定的事实协议下面。

## 二十、MVP 后端边界

```text
Web → API → Record / Patch / Projection / Snapshot services → MongoDB
              └─ Redis（配置运行时源 + PID 原子计数器）
```

* MongoDB collections：`records`、`snapshots`、`profiles`、`agent_drafts`、`agent_responses`、`agent_suggestions`。
* Redis：配置运行时源（`board:config`）与 PID 原子计数器（`board:pid:*`）；无 Redis 时降级内存实现。
* YAML：只做静态配置的导出与可视化（AI 编辑后导入），不再自动写回。
* 配置管理 API：`GET/POST /api/v0/config`、`GET/POST /api/v0/config/yaml`（开放在线编辑与热更新边界）。

## 二十一、明确不进入 MVP

* 真正区块链节点、多节点共识、链上签名、节点同步；
* 完整权限系统、RBAC、完整组织管理、完整 Tag 编辑后台（API 层无鉴权，公网部署前需补）；
* 多人实时协同编辑、CRDT、View 排序 merge / conflict；
* Agent 自动执行 Patch、自动绩效评价、大规模数据分析、推荐算法；
* 完整商业化体系、复杂社交系统。

这些暂时都不会提高当前核心假设的验证质量。

## 二十二、MVP 压缩成 7 个系统能力

```text
1. Fact            Record + Patch
2. Projection      Current state + List + Board
3. Organization    Tag + Assignee + Asset + Relation
4. View            Filter / Visible Columns / Column Order / Record Order
5. History         Patch History + Snapshot
6. Human / Agent   Context Pack + Agent Draft + Human Confirmation
7. Portability     Export
```

其中 **1～6 构成核心闭环，7 保证这些事实能够迁移出应用。**

## 二十三、当前完成度

```text
事实模型                ✅
Patch                    ✅
Projection               ✅
Board / List             ✅
History                  ✅
Snapshot                 ✅
Profile / Assignee       ✅
Asset / Relation         ✅
Agent Draft              ✅
Human confirmation       ✅
Export / Context Pack    ✅

Settings / View          ✅ Task12
Column order             ✅ Task12
Record order             ✅ Task15（2026-08 收尾）
Task12 browser acceptance ✅（docs/browser-acceptance-2026-08.md 链路 A-F 走查完成）

配置运行时管理          ✅（Redis 运行时源 + YAML 导入导出 + 热更新 + 原子 PID）
```

当前主要矛盾：

> **底层事实模型和主体产品结构基本成立，MVP 的 7 个系统能力（Fact / Projection / Organization / View / History / Human-Agent / Portability）与配置运行时管理已全部落地。** 之后不应继续无止境加功能，而应开始拿真实工作流跑一轮 MVP，观察"Record → Patch → Projection → Human/Agent → Patch"的循环是否真的成立。

### 超范围功能记录（MVP 之外已实现，2026-08 UX 打磨轮）

以下功能超出 MVP 定义范围，作为产品体验增强已并入 main，不改变 MVP 验证结论：

- 全局搜索命令面板（Cmd/Ctrl+K）与快捷键体系（N/B/L/?）
- Linear 风格左侧导航（AppSidebar），替代右上角 More 菜单
- Issues 独立视图（IssuesDrawer）
- 列表视图表格化（ListViewTable：列排序）与列重排（管理列对话框，非拖拽）
- 看板列头密度信息（优先级分布 / 负责人头像堆叠）
- 空态首次使用引导
- a11y 批量修复（icon aria-hidden、Intl 日期、aria-pressed 等）

> 后续新功能应明确评估"是否服务于 MVP 验证"，避免继续超范围扩张。

## 变更记录

| 日期 | 变更 | 对应 commit |
| --- | --- | --- |
| 2026-08-08 | 初版：基于 MVP 收束讨论（Task12 完成、Task15 待办）编写 | — |
| 2026-08-11 | Task15 标记完成；Task12 acceptance 标记完成；补记超范围 UX 功能清单 | docs 更新（mvp-scope-update） |
| 2026-08-11 | 整体重写：新增"配置与运行时状态管理"一节（Redis 运行时源 + YAML 导入导出 + 热更新 + 原子 PID）；后端边界与完成度同步更新 | PR #42（feat/redis-config-cache） |
