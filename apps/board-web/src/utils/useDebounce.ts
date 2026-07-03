import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export function useDebouncedValue<T>(
  value: T,
  delay: number,
  resetKey?: unknown
): T {
  const [debounced, setDebounced] = useState(value)
  const resetKeyRef = useRef(resetKey)

  useLayoutEffect(() => {
    if (Object.is(resetKeyRef.current, resetKey)) return
    resetKeyRef.current = resetKey
    setDebounced(value)
  }, [value, resetKey])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
