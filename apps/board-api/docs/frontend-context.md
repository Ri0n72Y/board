# Frontend Context

本文档给 board-web 第一阶段接入使用。当前前端目标是展示后端已经提供的 current board projection，不实现新的后端能力。

## 首要入口

前端当前看板初始化应优先调用：

```http
GET /api/v0/board/current
```

不要把 `GET /api/v0/records` 当作当前看板状态。`GET /records` 是 base records / facts 查询，不是 replay 后 current view。

展示当前看板时，以 `/board/current` 响应里的 `data.records[].body` 为准。

## 第一阶段建议

第一版 board-web 建议只做：

- 读取 `/api/v0/board/current`。
- 展示 records。
- 展示 tags。
- 展示 title / description / content。
- 展示 assignee。
- 展示 assets / relations 的基础信息。
- 展示 `blockedRecords`、top-level `diagnostics` 和 `summary.projectionStatus`。
- 支持 `/board/current` 的基础筛选 query：`tags`、`tagMatch`、`assignee`、`assetId`、`relationTarget`、`q`。
- 支持 `includeArchived` 切换。
- 支持查看单条 record history：`GET /api/v0/records/:id/history`。
- 为后续 create record / create patch 做接口准备。

最小展示可先不依赖 config；但标签选项、状态列、关系类型、创建表单应读取 `GET /api/v0/config`。

第一阶段暂时不要做：

- 登录。
- 权限。
- 链上签名。
- transaction。
- AI 批量 apply。
- full snapshot 管理。
- schema 用户筛选。
- profiles/config 聚合展示假设。

## 状态关系

前端需要理解当前后端状态关系：

```text
records collection 保存 base record 和 patch facts
snapshot head 保存 patch head cache
history 展示单条 record 演化
board current 展示当前看板投影
```

更具体地说：

- base record 是创建时事实。
- patch facts 是更新事实来源。
- snapshot head 是 append patch 的 optimistic concurrency cache。
- history 是单条 record 的 replay 解释。
- board current 是 board-level replay projection。

## Current Record 展示准则

`/board/current.records[]` 中每条记录的 envelope 形状是：

```ts
{
  createdBy: string
  createdAt: string
  body: RecordItem<RecordBody>
}
```

其中：

- `createdBy` / `createdAt` 来自 base record envelope。
- `body` 是 replay 后 current state。
- `body.id`、`body.pid`、`body.schema`、`body.tags`、`body.assignee`、`body.assets`、`body.relations` 和 `body.body` 用于当前看板展示。
- `body.body.title`、`body.body.description`、`body.body.content` 是当前 `q` 搜索覆盖的正文展示字段。

## Filter 使用

前端可组合使用：

```http
GET /api/v0/board/current?tags=status:todo&tags=type:card&tagMatch=all
GET /api/v0/board/current?tag=status:todo
GET /api/v0/board/current?assignee=...
GET /api/v0/board/current?assetId=...
GET /api/v0/board/current?relationTarget=...
GET /api/v0/board/current?q=...
GET /api/v0/board/current?includeArchived=true
```

注意：

- `tags` 可以重复；`tag` 是单 tag 兼容参数。
- `tagMatch` 默认是 `all`。
- `schema` 当前不作为用户筛选项。
- filter 基于 replay 后 current state。
- `q` 只搜索当前正文展示文本，不搜索 tags、assignee、asset、relation 或历史 patch。

## 后续写入接口准备

创建 record：

```http
POST /api/v0/records
```

更新 record：

```http
POST /api/v0/records/:id/patches
```

创建 patch 时，前端需要提供：

- `parentId`：客户端观察到的上一条 patch id；第一条 patch 为 `null`。
- `snapshotVersion`：客户端观察到的 snapshot head version。
- 需要变更的 `tags`、`assignee`、`body`、`assets`、`relations` 或 `description`。

创建 patch 前，前端应先读取：

```http
GET /api/v0/snapshot-head
```

然后按目标 record id 取值：

- 使用 snapshot head 的 `version` 作为 `snapshotVersion`。
- 使用 `records[recordId].lastPatchId` 作为 `parentId`。
- 如果没有 `records[recordId]` 或没有 `lastPatchId`，则 `parentId` 为 `null`。
- 如果提交 patch 返回 `409 CONFLICT`，应重新读取 `/api/v0/board/current` 和 `/api/v0/snapshot-head`，用最新 current/head 重新计算后再重试。

不要使用：

```http
PATCH /api/v0/records/:id
POST /api/v0/patches
```

前者固定 410，后者作为创建入口不存在。

## 当前不能假设的能力

- `/api/v0/snapshots/latest` 不存在。
- full snapshot persistence 尚未实现。
- transaction / dryrun / apply 尚未实现。
- 权限 / 登录尚未实现。
- signature / hash / protocolHash 尚未实现。
- `/board/current` 尚未聚合 profiles / config。
