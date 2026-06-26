import { extractApiErrorMessage } from './apiError.js'

interface CheckCase {
  name: string
  fn: () => void
}

const checks: CheckCase[] = []

function check(name: string, fn: () => void): void {
  checks.push({ name, fn })
}

check('extracts backend error code and message from Axios response envelope', () => {
  const error = {
    isAxiosError: true,
    message: 'Request failed with status code 503',
    response: {
      status: 503,
      data: {
        ok: false,
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'provider disabled',
        },
      },
    },
  }
  const message = extractApiErrorMessage(error)
  if (message !== 'PROVIDER_UNAVAILABLE: provider disabled') {
    throw new Error(`Unexpected message: ${message}`)
  }
})

check('falls back to HTTP status and Axios message without backend envelope', () => {
  const error = {
    isAxiosError: true,
    message: 'Request failed with status code 502',
    response: {
      status: 502,
      data: 'bad gateway',
    },
  }
  const message = extractApiErrorMessage(error)
  if (message !== 'HTTP 502: Request failed with status code 502') {
    throw new Error(`Unexpected message: ${message}`)
  }
})

check('returns plain Error message', () => {
  const message = extractApiErrorMessage(new Error('plain failure'))
  if (message !== 'plain failure') {
    throw new Error(`Unexpected message: ${message}`)
  }
})

check('stringifies unknown errors', () => {
  const message = extractApiErrorMessage('unknown failure')
  if (message !== 'unknown failure') {
    throw new Error(`Unexpected message: ${message}`)
  }
})

let passed = 0
let failed = 0

for (const { name, fn } of checks) {
  try {
    fn()
    passed += 1
    console.log(`  PASS ${name}`)
  } catch (err: unknown) {
    failed += 1
    const message = err instanceof Error ? err.message : String(err)
    console.log(`  FAIL ${name}`)
    console.log(`    ${message}`)
  }
}

console.log(`\n${passed} passed, ${failed} failed`)

if (failed > 0) {
  process.exit(1)
}
