# AI 自动化场景测试（E2E）

基于 Playwright Test 的确定性场景测试，覆盖浏览器验收链路的自动化执行。

## 结构

```
e2e/
├── playwright.config.ts   # 配置：webServer 起 api+web、baseURL、串行执行
├── fixtures/board.ts      # 夹具：beforeAll seed 杀戮尖塔数据 + api 客户端
├── helpers/api.ts         # API 封装（建卡/改状态/查投影/导出/draft/suggestion）
└── scenarios/
    ├── chain-a-daily-board.spec.ts   # 链路 A：日常看板操作闭环
    └── chain-b-agent-loop.spec.ts    # 链路 B：Agent 总结闭环
```

## 前置条件

- MongoDB 运行（`docker` 起 `mongo`，或本机服务）
- Redis 运行（`docker run -d --name redis -p 6379:6379 redis:7-alpine`）
- `apps/board-api/.env` 配置 `MONGODB_URI` / `MONGODB_DB` / `REDIS_URL`
- 首次安装浏览器：`pnpm e2e:install`

## 运行

```bash
pnpm e2e            # headless 全量
pnpm e2e:headed     # 有头模式（调试）
pnpm e2e -- --grep "链路 A"   # 只跑链路 A
pnpm e2e -- --grep "A2"      # 只跑单个用例
```

## 数据策略

- 每个场景文件 `beforeAll` 执行 `import:test-data --reset --data slay-the-spire-seed.json --profiles slay-the-spire-profiles.json`，保证从已知状态开始
- 场景内运行时产物（patch/快照/draft/suggestion）由脚本构造，不 seed
- 串行执行（workers:1），避免场景间数据竞争

## 断言层级

每个用例尽量双层验证：
1. **UI 断言**：看板/抽屉/徽标的可见性与状态
2. **API 断言**：通过 `api.getCurrentBoard()` 等验证数据真实落库

## 新增场景

1. 在 `scenarios/` 新建 `chain-x-*.spec.ts`
2. 从 `fixtures/board` 导入 `test`/`expect`（自动获得 seed + api 夹具）
3. 按"场景 → 步骤 → UI 断言 → API 断言"组织用例
