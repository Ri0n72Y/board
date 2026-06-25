# Repository Guidelines

## Project Structure

This is the **LabourBoard** monorepo — a structured project management board with backend API, frontend UI, and shared types.

```
.
├── apps/
│   ├── board-api/          # Hono + MongoDB backend (port 8787)
│   │   ├── config/         # Board config, skills (SKILL.md), env helpers
│   │   ├── docs/           # API contract, backend context, closure reports
│   │   ├── src/
│   │   │   ├── config/     # Runtime config, providers
│   │   │   ├── db/         # MongoDB client & collection helpers
│   │   │   ├── http/       # Response helpers (ok / error)
│   │   │   ├── repositories/  # Data access (Memory + Mongo impls)
│   │   │   ├── routes/     # Hono route handlers
│   │   │   └── services/   # Business logic (agent, record, snapshot, etc.)
│   │   └── coverage/       # Test coverage reports
│   └── board-web/          # React 19 + Vite 8 + Tailwind CSS 4
│       └── src/
│           ├── api/        # Axios-based API layer
│           ├── components/ # UI components (agentDrafts/, ui/)
│           ├── hooks/      # Controller hooks with AbortController
│           ├── i18n/       # en-US / zh-CN translations
│           ├── pages/      # Page-level components
│           ├── stores/     # Zustand stores
│           └── utils/      # Display utilities, devchecks
├── packages/
│   └── shared/             # Shared types, constants, utils (build first!)
│       └── src/
│           ├── interfaces/ # TypeScript interfaces (agent, record, snapshot, etc.)
│           ├── constants/  # Config schemas, tags, profiles
│           └── utils/      # Board export, context pack, filter logic
├── public/                 # Static assets
├── test-data/              # Sample board data for import
└── memory/                 # Memory store persistence snapshots
```

## Build, Test, and Development Commands

| Command | Scope | Purpose |
|---------|-------|---------|
| `pnpm --filter @labour-board/shared build` | Shared | Build shared types first — required before API/Web |
| `pnpm --filter @labour-board/api dev` | API | Start API server with hot reload on http://localhost:8787 |
| `pnpm --filter @labour-board/web dev` | Web | Start Vite dev server |
| `pnpm --filter @labour-board/api test` | API | Run Vitest test suite (478+ tests) |
| `pnpm --filter @labour-board/api typecheck` | API | Check TypeScript (src + test configs) |
| `pnpm --filter @labour-board/web typecheck` | Web | Check TypeScript (`tsc -b` with project refs) |
| `pnpm --filter @labour-board/web lint` | Web | Run ESLint on all TS/TSX files |
| `pnpm --filter @labour-board/web build` | Web | Typecheck then Vite production build |
| `pnpm format` | Root | Format all files with Prettier |
| `pnpm dev` | Root | Run API + Web dev servers in parallel |

**Devchecks**: Standalone utility test scripts run via `tsx`:

```bash
pnpm --filter @labour-board/api exec tsx ../board-web/src/utils/agentSuggestionDisplay.devcheck.ts
```

## Coding Style & Naming

- **Formatting**: Prettier — `semi: false`, `singleQuote: true`, `trailingComma: "es5"`
- **Linting**: ESLint with TypeScript ESLint, React Hooks, and React Refresh plugins
- **Module system**: ESM (`"type": "module"`), `NodeNext` module resolution
- **TypeScript**: Strict mode, `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`
- **Naming**: PascalCase components, camelCase variables/functions, kebab-case files
- **Imports**: Always use `.js` extensions in imports (required by `NodeNext`)

## Testing Guidelines

- **Framework**: Vitest (`vitest run` — no watch by default in CI)
- **Coverage**: Vitest v8 coverage provider
- **Repository tests**: Each repository has both a `Memory*Repository` (in-memory) and `Mongo*Repository` (optional, requires MongoDB). Tests default to memory; `app.mongo-smoke.test.ts` is skipped without MongoDB.
- **Route tests**: Create a full Hono app via `createTestApp()`, make HTTP requests with `app.request()`, assert on status codes and JSON payloads.
- **Service tests**: Instantiate services with memory repositories and mock providers.
- **File naming**: `*.test.ts` alongside source files.
- **Devchecks**: `*.devcheck.ts` files in `board-web/src/utils/` test display utilities without a browser.

## Commit & Pull Request Guidelines

- **Commit format**: `{scope}/{version} [{status}] {description}`
  - Examples: `deepcode/2.3 [pass] agent ability`, `codex/1.31 [pass] P1 closure`
  - Status tags: `[pass]`, `[hold]`, `[checkpoint]`
- **Scopes**: `deepcode`, `codex` (reflect the agent/iteration that produced the work)
- **PRs**: Reference the Deepcode instruction document; ensure `typecheck`, `lint`, and `test` gates pass before submission.
- **Memory snapshots**: The `memory/` directory stores persistence snapshots for the memory storage backend — do not manually edit these files.

## Architecture Notes

- **Backend**: Hono app assembled in `app.ts`, routes mounted in `src/routes/index.ts`, services wired in `src/services/index.ts`. MongoDB is optional — the app runs with memory storage when `MONGODB_URI` is absent.
- **Frontend**: Single-page app (no React Router). Drawers manage modal navigation. Zustand stores manage board state. API layer uses Axios with `AbortController` support in all hooks.
- **Agent workflow**: Non-executing — drafts are reviewed by humans before formal handoff. AI suggestions are read-only analysis artifacts. No board mutation occurs through the agent pipeline.
- **Shared package**: Must be built (`pnpm --filter @labour-board/shared build`) before API or Web can typecheck due to TypeScript project references and `composite: true`.
