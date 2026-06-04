# API Contract

本文档是前端接入前的开发者可读 contract，不是完整 OpenAPI。所有成功响应都遵循共享结构：

```ts
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError }
```

## 接口分类

- 事实接口：读取或写入 base record、patch facts、profiles、config、snapshot head cache。
- Projection 接口：读取 replay 后的当前看板视图，不写事实。当前只有 `GET /api/v0/board/current`。

## Config

### `GET /api/v0/config`

- 用途：读取 yaml config 归一化后的当前配置。
- 前端直接使用：可以。最小看板展示可先不依赖 config；但标签选项、状态列、关系类型、创建表单应读取 config。
- 请求方式：`GET`。
- 关键 query / body：无。
- 返回核心结构：`BoardConfig`。
- 常见错误：当前路由无显式业务错误。
- 类型：事实配置读取接口。config 来源是 yaml，不是 Mongo config collection。

## Profiles

### `GET /api/v0/profiles`

- 用途：读取 profile 列表。
- 前端直接使用：可以用于后续 assignee 展开；第一阶段 `/board/current` 不会自动聚合 profiles。
- 请求方式：`GET`。
- 关键 query / body：无。
- 返回核心结构：`Profile[]`。
- 常见错误：当前路由无显式业务错误。
- 类型：事实接口。

### `POST /api/v0/profiles`

- 用途：创建 profile。
- 前端直接使用：后续 profile 管理可用；看板第一阶段不建议优先做。
- 请求方式：`POST`。
- 关键 body：`CreateProfileInput`，当前等同 `Profile`。
- 返回核心结构：创建后的 `Profile`。
- 常见错误：`400 INVALID_PROFILE`、`409 PROFILE_EXISTS`。
- 类型：事实接口。

### `GET /api/v0/profiles/:profileKey`

- 用途：读取单个 profile。
- 前端直接使用：可以。
- 请求方式：`GET`。
- 关键 path：`:profileKey`，表示 profile key / public key。
- 返回核心结构：`Profile`。
- 常见错误：`404 NOT_FOUND`。
- 类型：事实接口。

### `PATCH /api/v0/profiles/:profileKey`

- 用途：更新 profile 的 `name` / `extra`。
- 前端直接使用：后续 profile 管理可用。
- 请求方式：`PATCH`。
- 关键 body：`UpdateProfileInput`，包括可选 `name` 和 `extra`。
- 返回核心结构：更新后的 `Profile`。
- 常见错误：`400 INVALID_PROFILE`、`404 NOT_FOUND`。
- 类型：事实接口。

## Records

### `GET /api/v0/records`

- 用途：查询 base records / legacy list。
- 前端直接使用：不推荐作为当前看板入口；当前看板必须使用 `/api/v0/board/current`。
- 请求方式：`GET`。
- 关键 query：`id`、`pid`、`schema`、`tags`、`tagMatch=all|any`、`assignee`、`assetId`、`relationTarget`、`includeArchived`、`q`、`limit`。该接口的 `q` 会搜索 base record 的 id、pid、schema、assignee、tags 和正文展示字段。
- 返回核心结构：`RecordResponse<RecordItem<RecordBody>>[]`。
- 常见错误：当前 list 路由无显式业务错误。
- 类型：事实接口。它不 replay patches。

### `POST /api/v0/records`

- 用途：创建 base record。
- 前端直接使用：可以作为后续 create record 入口；第一阶段可先预留。
- 请求方式：`POST`。
- 关键 header：可选 `x-actor-id`，缺省 actor 为 `local`。
- 关键 body：`CreateRecordInput`，包括 `pidPrefix`、`schema`、`tags`、`assignee`、`body`、`assets`、`relations`。
- 返回核心结构：创建后的 `RecordResponse<RecordItem<RecordBody>>`，HTTP 201。
- 常见错误：`400 INVALID_RECORD`。
- 类型：事实接口。

### `GET /api/v0/records/:id`

- 用途：按 id 读取单条 base record。
- 前端直接使用：可以用于调试或 base fact 读取；当前看板展示不要用它替代 `/board/current`。
- 请求方式：`GET`。
- 关键 path：`:id`。
- 返回核心结构：`RecordResponse<RecordItem<RecordBody>>`。
- 常见错误：`404 NOT_FOUND`。
- 类型：事实接口。它不 replay patches。

### `DELETE /api/v0/records/:id`

- 用途：归档 record。当前会 append archive patch，并兼容性更新 base record tags。
- 前端直接使用：后续可用；第一阶段只建议展示 archived 语义和 includeArchived 切换。
- 请求方式：`DELETE`。
- 关键 path：`:id`。
- 返回核心结构：归档后的 `RecordResponse<RecordItem<RecordBody>>`。
- 常见错误：`404 NOT_FOUND`、`409 CONFLICT`。
- 类型：事实接口。长期应由 current projection 统一表达归档状态。

### `PATCH /api/v0/records/:id`

- 用途：legacy direct record PATCH。
- 前端直接使用：禁止。
- 请求方式：`PATCH`。
- 关键 body：无意义，不应发送。
- 返回核心结构：固定错误响应。
- 常见错误：固定 `410 GONE`，错误信息要求使用 `POST /api/v0/records/:id/patches`。
- 类型：禁用的 legacy 入口。

## Patches

### `POST /api/v0/records/:id/patches`

- 用途：向指定 record append patch，是当前更新 record 的唯一推荐入口。
- 前端直接使用：后续 create patch / edit flow 应使用它。
- 请求方式：`POST`。
- 关键 header：可选 `x-actor-id`，缺省 actor 为 `local`。
- 关键 path：`:id` 是 targetId。
- 关键 body：`CreateRecordPatchInput`，包括 `parentId`、`snapshotVersion`，以及可选 `tags`、`assignee`、`body`、`assets`、`relations`、`description`。body 中禁止提供 `targetId`，targetId 来自 path。
- 返回核心结构：`{ patch, newSnapshotVersion }`，HTTP 201。
- 常见错误：`400 INVALID_PATCH`、`404 NOT_FOUND`、`409 CONFLICT`。
- 类型：事实接口。

旧 `POST /api/v0/patches` 创建入口不存在，前端不要使用。

### `GET /api/v0/patches/:id`

- 用途：按 id 读取单条 patch fact。
- 前端直接使用：可以用于调试或 history 细节；普通看板展示不需要优先调用。
- 请求方式：`GET`。
- 关键 path：`:id`。
- 返回核心结构：`RecordResponse<PatchItem<DeepPartial<RecordBody>>>`。
- 常见错误：`404 NOT_FOUND`。
- 类型：事实接口。

### `GET /api/v0/patches?targetId=xxx`

- 用途：读取某条 record 的 patch facts 列表。
- 前端直接使用：可以用于调试；普通 history 展示优先使用 `/records/:id/history`。
- 请求方式：`GET`。
- 关键 query：必填 `targetId`。
- 返回核心结构：`RecordResponse<PatchItem<DeepPartial<RecordBody>>>[]`。
- 常见错误：`400 INVALID_QUERY`。
- 类型：事实接口。

## History

### `GET /api/v0/records/:id/history`

- 用途：展示单条 record 从 base record 到 patches replay 后的演化。
- 前端直接使用：推荐用于单条 record history 详情。
- 请求方式：`GET`。
- 关键 path：`:id`。
- 返回核心结构：`RecordHistoryResponse`，包括 `record`、`status`、`patches`、可选 `diagnostics` 和 `replay`。
- 常见错误：`404 NOT_FOUND`。
- 类型：事实 + replay 读取接口。它展示单条 record 演化，不是 board-level projection。

## Snapshot Head

### `GET /api/v0/snapshot-head`

- 用途：读取当前 patch head cache。
- 前端直接使用：普通看板展示不需要；创建 patch 前可用于取得 `snapshotVersion` 和 lastPatchId。
- 请求方式：`GET`。
- 关键 query / body：无。
- 返回核心结构：`{ version, records }`。
- 常见错误：当前路由无显式业务错误；snapshot head integrity error 可能由底层抛出。
- 类型：并发控制 cache 读取接口，不是完整当前态事实。

## Board Current

### `GET /api/v0/board/current`

- 用途：读取前端当前看板主视图。
- 前端直接使用：强烈推荐作为 board-web 第一阶段初始化主入口。
- 请求方式：`GET`。
- 关键 query：见下列筛选接口。
- 返回核心结构：`BoardCurrentProjection`，包括 `snapshotHeadVersion`、`records`、`blockedRecords`、`summary`、可选 `diagnostics`。
- 常见错误：当前路由无显式业务错误；projection 问题通过 `blockedRecords`、`summary.projectionStatus` 或 top-level `diagnostics` 表达。
- 类型：只读 projection 接口。它不写入数据库，不是新的事实来源。

支持的 query：

- `GET /api/v0/board/current?includeArchived=true`：包含 current state 中带 `status:archived` 的 records。
- `GET /api/v0/board/current?tag=...`：兼容单 tag 查询。
- `GET /api/v0/board/current?tags=...`：可重复传递多个 `tags` 参数。
- `GET /api/v0/board/current?tagMatch=all|any`：默认为 `all`；只有显式 `any` 才使用 any。
- `GET /api/v0/board/current?assignee=...`
- `GET /api/v0/board/current?assetId=...`
- `GET /api/v0/board/current?relationTarget=...`
- `GET /api/v0/board/current?q=...`

`/board/current` 的 filter 发生在 replay 后 current state，不使用 base record 筛选；`schema` 当前不作为用户筛选项。
