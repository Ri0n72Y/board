# Board Current

`GET /api/v0/board/current` 是前端当前看板主入口。它代表用户实际看到的当前状态：

```text
base record + ordered patches + replay = current state
```

它不是新的事实来源，不写入数据库，不推进 snapshot head，也不持久化 current projection。

## 返回结构

成功响应为 `ApiResponse<BoardCurrentProjection>`，`data` 至少包含：

- `snapshotHeadVersion`：读取到的 snapshot head version。snapshot head integrity error 时当前实现会返回 `-1` 并附带 diagnostics。
- `records`：可投影、可展示的 current records。
- `blockedRecords`：无法投影的 broken / conflicted records。
- `summary`：projection 摘要。
- `diagnostics`：可选，board-level projection 问题，例如 snapshot head integrity error。

`records[]` 的元素是 `RecordResponse<RecordItem<RecordBody>>`：

- `records[].body` 是 replay 后的 current state。
- `records[].createdBy` / `records[].createdAt` 来自 base record envelope。
- `records[].body` 不包含 envelope audit fields。
- broken / conflicted records 不会混入 `records[]`。

`blockedRecords[]` 包含：

- `recordId`
- `status: "broken" | "conflicted"`
- `diagnostics`

## Archived 语义

默认情况下，`/board/current` 隐藏 current state 中包含 `status:archived` tag 的 records。

`includeArchived=true` 时返回 archived current records。archived 判断基于 replay 后 `finalState.tags`，不是 base record tags。archived 返回时同样展示 replay 后 current state。

`summary.archivedRecords` 是 projection-level archived count，不是 filter 后的 result count。

## Filter 语义

当前支持：

- `tag=...`：兼容单 tag 查询。
- `tags=...`：可重复传递多个 `tags` 参数。
- `tagMatch=all | any`：默认为 `all`；只有显式 `any` 才使用 any。
- `assignee=...`
- `assetId=...`
- `relationTarget=...`
- `q=...`
- `includeArchived=true`

所有 filter 都发生在 replay 后的 current state：

- 不使用 base record 筛选。
- `schema` 不作为用户筛选项。
- 用户侧分类应通过 tags 表达。
- `q` 是轻量正文搜索，不是全文搜索系统。

## q 搜索范围

`q` 只搜索当前正文展示文本：

- `body.title`
- `body.description`
- `body.content`

`q` 不搜索：

- record id
- pid
- schema
- tags
- assignee
- asset id
- asset uri
- relation target
- relation constraint
- createdBy / createdAt
- parentId / targetId
- patch description
- 历史 patch facts

这个范围和 `GET /api/v0/records?q=...` 不同。`GET /records` 查询的是 base record，搜索范围更偏 legacy list；前端当前看板搜索应以 `/board/current?q=...` 为准。

## Summary 语义

`summary` 当前包含：

- `totalBaseRecords`：参与 projection 的 base record 总数。
- `visibleCurrentRecords`：返回给调用方的 current records 数量，始终等于 `records.length`。
- `archivedRecords`：projection-level archived count。
- `blockedRecords`：无法投影的 records 数量。
- `projectionStatus`：`"empty" | "clean" | "partial" | "blocked"`。

`projectionStatus` 表示 board projection 的全局健康，不表示 filter 后是否为空。

- 没有 base records 且 snapshot head 正常时是 `empty`。
- 有 base records、没有 archived/blocked/head 问题时是 `clean`。
- 存在 archived records、blocked records 或 head 问题，但仍有可见 records 时通常是 `partial`。
- 没有可见 records 且存在 blocked/head 问题时是 `blocked`。

filter 后 `records` 为空，但 projection 健康时，`projectionStatus` 可以仍然是 `clean`。filter 不应把 `blockedRecords` 或 top-level `diagnostics` 静默变成 clean。

## 前端使用建议

board-web 初始化当前看板时调用：

```http
GET /api/v0/board/current
```

展示时以 `data.records[].body` 为准。需要展示异常状态时，同时读取 `data.blockedRecords`、`data.diagnostics` 和 `data.summary.projectionStatus`。

不要把 `GET /api/v0/records` 当成当前看板状态；它不 replay patches。
