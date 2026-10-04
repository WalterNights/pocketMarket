import { useEffect, useState } from 'react'

/**
 * `value`, but only once it has stopped changing for `delayMs`.
 *
 * For search-as-you-type: every keystroke would otherwise be a request over
 * the radio and a skeleton flash. The input stays bound to the live value; the
 * query reads the debounced one.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
