# 数据流图 — LabourBoard

> 维护规则：链路涉及的类/端点改名或增减时同步本图。对应代码位置见各图下方引用。

## 1. 记录保存（patch 提交）链路

```mermaid
sequenceDiagram
    actor U as 用户
    participant Drawer as RecordDetailDrawer / MoveStatusControl
    participant Hook as useStatusMoveController / Drawer 内逻辑
    participant API as api/patches.ts
    participant Route as recordPatchRoute
    participant Svc as RecordService.createRecordPatch
    participant Submit as recordPatchSubmit.ts
    participant Repo as SnapshotHeadRepository
    participant DB as MongoDB / Memory
    participant Store as useBoardCurrentStore

    U->>Drawer: 编辑记录 / 拖拽移动状态
    Drawer->>Hook: 提交变更（含 parentId/currentVersion）
    Hook->>API: submitRecordPatch(id, patch)
    API->>Route: POST /records/:id/patches
    Route->>Svc: createRecordPatch
    Svc->>Submit: 校验 parentId/currentVersion（乐观并发）
    alt 冲突
        Submit-->>API: CurrentHeadConflictError → 409
        API-->>Hook: RecordPatchConflictError（提示合并）
    else 成功
        Submit->>Repo: appendPatchAndAdvanceHead（事务内写 patch + 推进快照头）
        Repo->>DB: 写 records collection（patch 文档带 targetId）+ snapshots 中 snapshotHead 文档
        DB-->>Submit: OK
        Submit-->>Svc: 返回新 patch
        Svc-->>Hook: 成功
        Hook->>Store: applyCommittedRecord（投影局部更新，不整页刷新）
        Store-->>Drawer: 界面即时反映
    end
```

**要点**：`records` 与 `patch` 存同一 collection，用 `targetId` 是否存在区分（base record 无 `targetId`，patch 有）；并发冲突通过 `parentId + currentVersion` 校验，返回 409。`snapshotHead` 不是独立 collection，而是 `snapshots` collection 中 `kind: 'snapshotHead'` 的文档（`version` + `records: { [recordId]: lastPatchId }`）；手动快照为 `kind: 'manualSnapshot:<id>'`。

## 2. 记录创建链路

```mermaid
flowchart LR
    CreateDrawer[CreateRecordDrawer] -->|createRecord| recordsApi[api/records.ts]
    recordsApi -->|POST /records| CrudRoute[recordCrudRoute]
    CrudRoute -->|create| RecordSvc[RecordService.create]
    RecordSvc -->|drawPid| Pid[PidAllocator]
    RecordSvc -->|create| Repo[RecordRepository]
    Repo --> DB[(MongoDB records / Memory)]
    RecordSvc -->|返回 record| CreateDrawer
```

## 3. 快照创建与导出链路

```mermaid
sequenceDiagram
    participant Hook as useSnapshotController
    participant API as api/snapshots.ts
    participant Route as snapshots.ts
    participant Svc as SnapshotService
    participant Proj as getBoardCurrentProjection
    participant Repo as SnapshotRepository
    participant DB as MongoDB snapshots

    Hook->>API: createSnapshot()
    API->>Route: POST /snapshots
    Route->>Svc: createManualSnapshot
    Svc->>Proj: 只读装配当前投影
    Proj->>Repo: listPatches + 读 base records（只读）
    Svc->>Repo: create（kind: 'manualSnapshot:<id>'）
    Repo->>DB: 写入 snapshots collection
    DB-->>Svc: OK
    Svc-->>Hook: 快照摘要

    Hook->>API: exportSnapshot(id)
    API->>Route: GET /snapshots/:id/export
    Route->>Svc: 读快照详情
    Svc->>shared: buildBoardContextPack / buildBoardMarkdownExport
    shared-->>Hook: 导出内容 → utils/download.ts 下载
```

## 4. Agent 建议（只读分析）链路

```mermaid
flowchart LR
    Draft[Draft 抽屉 AgentSuggestionSection] -->|generateSuggestion| SugApi[api/agentSuggestions.ts]
    SugApi -->|POST /agent/drafts/:draftId/suggestions| SugRoute[agentSuggestions.ts]
    SugRoute -->|createSuggestion| SugSvc[AgentSuggestionService]
    SugSvc -->|校验 draft 已 reviewed| DraftRepo[AgentDraftRepository]
    SugSvc -->|resolveSkillSnapshots| SkillSvc[AgentSkillService]
    SugSvc -->|checkSuggestionBudget| Budget[agentProviderBudget]
    SugSvc -->|generate| Provider[AgentSuggestionProvider: mock / openai-compatible / disabled]
    SugSvc -->|validateSuggestionOutput| Quality[agentSuggestionQuality]
    SugSvc -->|create| SugRepo[AgentSuggestionRepository]
    SugRepo --> DB[(MongoDB agent_suggestions / Memory)]
```

**要点**：本链路**全程不写看板数据**（不触碰 records/snapshots），是只读分析产物；建议经人工 review（PATCH `/agent/suggestions/:id/review`）后才进入交接流程。

## 5. 看板加载与导出链路

```mermaid
flowchart LR
    Mount[BoardCurrentPage 挂载] -->|loadCurrentBoard| Store[useBoardCurrentStore]
    Store -->|fetchBoardCurrent| CurApi[api/boardCurrent.ts]
    CurApi -->|GET /board/current| CurRoute[boardCurrent.ts]
    CurRoute -->|getBoardCurrentProjection| Proj[boardCurrentService]
    Proj -->|读 snapshotHead 版本 + base records + 逐条投影| Repos[RecordRepository + SnapshotHeadRepository]
    Repos --> DB[(MongoDB / Memory)]
    Proj -->|filterBoardCurrentRecords| Filter[过滤: draft/effective/lastApplied]
    Proj -- 投影 --> CurRoute --> CurApi --> Store
    Store -->|渲染| View[BoardView / useBoardViewModel 按状态分列]

    Export[Export 抽屉] -->|exportCurrentBoard| ExpApi[api/exports.ts]
    ExpApi -->|GET /board/current/export| ExpRoute[boardCurrentExport.ts]
    ExpRoute --> Proj
    Proj -->|buildBoardMarkdownExport / buildBoardContextPack| shared
    shared -->|下载文件| Download[utils/download.ts]
```

## 变更记录

| 日期 | 变更 | 对应 commit |
| --- | --- | --- |
| 2026-08-08 | 初版：基于 P10-P12 后代码（commit 79e6798）绘制 | cc07945 |
