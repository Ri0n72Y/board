import { execSync } from 'node:child_process'
import { test as base, expect, type APIRequestContext } from '@playwright/test'
import { BoardApi } from '../helpers/api'

/**
 * Board E2E fixtures.
 *
 * `seedBoard` runs before each scenario file: clears the database and loads
 * the Slay the Spire seed (17 records + 6 profiles) so every scenario starts
 * from a known state.
 */

export interface BoardFixtures {
  api: BoardApi
  request: APIRequestContext
}

function seedDatabase(): void {
  execSync(
    'pnpm --filter @labour-board/api import:test-data -- --reset --data slay-the-spire-seed.json --profiles slay-the-spire-profiles.json',
    { cwd: process.cwd(), stdio: 'pipe' }
  )
}

export const test = base.extend<BoardFixtures>({
  api: async ({ request }, use) => {
    use(new BoardApi(request))
  },
})

test.beforeAll(async () => {
  seedDatabase()
})

export { expect }
