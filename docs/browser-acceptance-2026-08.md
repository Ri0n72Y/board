# 浏览器验收清单（Task12 + 收束功能）

日期：2026-08-10
状态：待执行（清单与 issue #13 一致，执行结果回贴 issue #13 评论区）

范围：Task12（Settings / View 基础设施与 Record Detail 编辑体系）+ 后续收束（拖拽、归档、状态）在真实浏览器中逐项走查。

## 1. 自动化测试现状（新会话先跑一遍确认未回归）

以下命令在 `board/` 根目录执行，全部通过后再进入浏览器验收：

```bash
pnpm --filter @labour-board/api test        # vitest，603 passed / 1 skipped
pnpm --filter @labour-board/web typecheck   # 0 错误
pnpm --filter @labour-board/web lint        # 0 错误
# devcheck（web + shared 共 16 个，用 api 的 tsx 运行）
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

## 3. 验收清单（链路式，上一步产物是下一步输入）

### 链路 A：日常看板操作
- [ ] 打开看板，列按配置显示；新建卡片（状态选项应为 待办/待规划/进行中/已完成/阻塞 五种，默认待办，无"归档"选项）
- [ ] 卡片显示状态 badge（中文如"进行中"，非原始 id）；点击 badge 弹出 5 状态菜单，选中即改状态
- [ ] 整卡拖拽（按住卡片拖动，快速点击仍打开详情）：跨列移动后卡片进入目标列；同列拖到精确位置落点即悬停处，无闪烁
- [ ] 拖拽中目标列显示半透明预览卡（pid + 标题 + 负责人）；拖回原位预览消失
- [ ] 连续快速拖拽多张卡不出现 "version mismatch"；刷新后顺序与状态保留；Esc 取消无副作用

### 链路 B：归档
- [ ] 打开卡片详情 → footer 有"归档"按钮；点击弹出原因对话框（可选填）→ 确认归档
- [ ] 归档后卡片仍留在原状态列（如 doing 列），"包含已归档"未勾选时隐藏，勾选后显示
- [ ] 归档后卡片不可再编辑/修改状态；投影顶部不再显示"投影不完整"警告（归档是正常状态）
- [ ] History 里能看到 `Archive: <原因>` 的 patch 记录

### 链路 C：组织与筛选
- [ ] 多选标签筛选为 OR 语义；刷新后筛选与列显隐保留
- [ ] 已归档记录在筛选结果中按"包含已归档"开关控制

### 链路 D：追溯与导出
- [ ] 详情 History 面板展示 patch 链（含归档 patch）；快照查看/导出/上下文导出正常

### 链路 E：异常与恢复
- [ ] 停掉 board-api 或 MongoDB 后刷新：错误提示为友好文案（"无法连接看板服务"或"看板服务暂时不可用"），且有"重试"按钮；恢复后重试成功
- [ ] 造一条 blocked 记录（如 patch 链断裂）：投影标记 partial/blocked 且 IssuesPanel 两种视图可见

### 链路 F：可访问性抽查
- [ ] Tab 走查按钮/下拉/抽屉焦点可见；系统"减少动态效果"开启后抽屉无滑入动画
- [ ] 状态 badge 菜单键盘可操作

## 4. 记录格式与回写

每项 ✅ / ❌（❌ 附复现步骤）。完成后：
1. 勾选本文档对应项，提交到 `docs/browser-acceptance-2026-08.md`；
2. 结果贴回 issue #13 评论区；
3. 验收中发现的问题开新 issue（分支命名 `feat/<issue号>-<短描述>`，走 issue → 分支 → PR 闭环）。

## 5. 已知注意事项（执行时参考）

- 整卡拖拽是"长按激活"：按住卡片移动即拖拽，快速点击是打开详情，两者不冲突。
- 状态改动与拖拽都走 optimistic patch（version 并发保护）：连续操作前不需要手动刷新。
- 归档 = `lifecycle:archived` tag，与状态列独立；已归档记录仍保留原状态列位置。
- 投影顶部"投影不完整"警告只在 blocked/conflicted 时出现，归档不算问题记录。
- 本机如已造过测试数据（如 CARD-3x 系列），验收前可清库或直接复用。
