# Backend Baseline

本文档记录 LabourBoard 后端在前端接入前的当前基线。它只描述已经验收的后端能力和明确后置的边界，不代表未来完整产品形态。

## 产品定位

当前 `board-api` 是 LabourBoard 的事实写入、事实读取和当前看板投影服务。后端以 base record 和 patch facts 保存事实，以 snapshot head 做 patch append 的并发控制缓存，并通过 `/api/v0/board/current` 给前端提供只读 current projection。

前端看板应把 `/api/v0/board/current` 作为当前状态主入口；`GET /api/v0/records` 仍是 base records / legacy list 查询，不是 replay 后的当前看板视图。

## 当前阶段边界

当前已经进入前端接入前的文档整理阶段。已完成的后端能力包括：

- yaml config 读取。
- profiles 基础 CRUD 能力。
- records CRUD、pid 生成。
- legacy `PATCH /api/v0/records/:id` 固定返回 410。
- patch 创建入口 `POST /api/v0/records/:id/patches`。
- patch 按 id 读取、按 targetId 列表读取。
- snapshot head 读取。
- patch append + snapshot head optimistic concurrency。
- record history。
- record-local replay。
- archive patch。
- board current projection 和 `GET /api/v0/board/current`。
- board current shared API contract。
- app-level integration smoke、Mongo smoke。
- standalone Mongo fallback cleanup。
- Board Current Filter：`tags`、`tagMatch`、`assignee`、`assetId`、`relationTarget`、`q`、`includeArchived`，并且 filter 基于 replay 后的 current state。

当前未实现、不能让前端误用的能力：

- full snapshot persistence。
- `/api/v0/snapshots/latest`。
- transaction / dryrun / apply。
- 权限 / 登录。
- signature / hash / protocolHash。
- board-web 前端接入。
- board current 聚合 profiles/config。

## Mongo Collection 边界

当前 Mongo 边界只有三个 collection：

- `records`：保存 base record，也保存 patch facts。代码通过 `targetId` 是否存在区分 base record 和 patch fact。
- `snapshots`：当前保存 `kind: "snapshotHead"` 的 snapshot head 文档，用于 patch append 并发控制缓存。
- `profiles`：保存 profile 文档。

当前没有 Mongo config collection。config 来源是 yaml，默认路径和运行时路径由 API config loader / env 决定。

## 核心职责

`records` 保存 base record。base record 是记录创建时的事实 envelope，包括 `createdBy`、`createdAt` 等审计字段，以及初始 `RecordItem`。

patch facts 是 record 演化的事实来源。前端提交更新时应使用 `POST /api/v0/records/:id/patches` append patch，不应使用 legacy direct PATCH。

snapshot head 是并发控制 cache，不是完整当前态事实。它保存当前 snapshot version 和每条 record 的 lastPatchId，用于校验客户端提交 patch 时观察到的版本和 parentId。

profiles 保存用户/profile 基础信息。当前 board current 尚未聚合 profiles，因此前端需要把 `assignee` 当作当前 record body/envelope 上的 key 显示，不能期待 `/board/current` 已经返回 profile 展开信息。

board current 是只读 projection。它读取 base record 和 patch facts，按 patch chain replay 出 current state，然后返回给前端。current projection 不写入 `records` 或 `snapshots`。

## Archive 语义

archive 是 archive patch。`DELETE /api/v0/records/:id` 当前会 append 带 `status:archived` 的 archive patch，并为兼容旧查询同步更新 base record tags。长期当前态应由 projection 统一表达，不能把这个兼容动作理解为 full snapshot persistence。

## 已知技术债

- full snapshot persistence 尚未实现。
- `/api/v0/snapshots/latest` 尚未实现。
- `GET /api/v0/records` 仍是 base records / legacy list，不是 current projection。
- `DELETE /api/v0/records/:id` 当前仍包含 base record archive 兼容动作，长期应由 current projection 统一。
- board current 尚未聚合 profiles / config。
- Mongo standalone fallback 在正常 CAS failure 时会 cleanup；如果进程在 insert patch 和 cleanup 之间崩溃，仍可能留下 residual patch。
- 生产强一致建议使用 Mongo replica set transaction。
- transaction / dryrun / apply 后置。
- 权限 / 登录后置。
- signature / hash / protocolHash 后置。

## 当前验证情况

当前代码中已有 app-level integration smoke、Mongo smoke、board current route/service/filter tests、record history tests、record patch submit tests、snapshot head repository tests、profiles tests 和 config tests。当前基线覆盖的验证类型包括 board-api typecheck、board-api tests、root typecheck、Mongo smoke（env-gated）。已有对应测试与 smoke，最近基线验证通过情况见提交记录/开发报告。本文档变更不修改业务代码。
