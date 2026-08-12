import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 全局启动 api + web（独立进程，绕过 playwright webServer 在 Windows 上的探测问题）。
 * 结束时 kill 两个进程组。
 */
let apiProc: ChildProcess | undefined
let webProc: ChildProcess | undefined
let cleanupLog: string | undefined

async function waitFor(urls: string[], timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    for (const url of urls) {
      try {
        const res = await fetch(url)
        if (res.ok) return
      } catch {
        /* retry */
      }
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`timed out waiting for ${urls.join(' / ')}`)
}

export default async function globalSetup(): Promise<() => void> {
  const root = process.cwd()
  const logDir = mkdtempSync(join(tmpdir(), 'board-e2e-'))
  cleanupLog = join(logDir, 'services.log')

  apiProc = spawn('pnpm --filter @labour-board/api dev', {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  })
  apiProc.stdout?.on('data', (d) => process.stdout.write(`[api] ${d}`))
  apiProc.stderr?.on('data', (d) => process.stderr.write(`[api] ${d}`))

  await waitFor(['http://localhost:8787/health', 'http://localhost:8787/health'], 60_000)

  webProc = spawn(
    'pnpm --filter @labour-board/web dev -- --port 5173 --strictPort',
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: true }
  )
  webProc.stdout?.on('data', (d) => process.stdout.write(`[web] ${d}`))
  webProc.stderr?.on('data', (d) => process.stderr.write(`[web] ${d}`))

  await waitFor(['http://localhost:5173', 'http://localhost:5173'], 60_000)

  return async () => {
    for (const p of [webProc, apiProc]) {
      if (!p) continue
      try {
        execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' })
      } catch {
        /* already dead */
      }
    }
  }
}
