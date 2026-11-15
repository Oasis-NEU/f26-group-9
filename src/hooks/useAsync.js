import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// Run an async loader whenever `deps` (primitives) change, or on reload().
// Loading is derived from whether the last settled run matches the current
// key, so there are no synchronous setState calls inside the effect.
export function useAsync(loader, deps) {
  const loaderRef = useRef(loader)
  useLayoutEffect(() => {
    loaderRef.current = loader
  })

  const [nonce, setNonce] = useState(0)
  const runKey = `${JSON.stringify(deps)}#${nonce}`
  const [state, setState] = useState({ key: null, data: undefined, error: null })

  useEffect(() => {
    let cancelled = false
    loaderRef.current().then(
      (data) => !cancelled && setState({ key: runKey, data, error: null }),
      (error) => !cancelled && setState({ key: runKey, data: undefined, error }),
    )
    return () => {
      cancelled = true
    }
  }, [runKey])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data: state.data, error: state.error, loading: state.key !== runKey, reload }
}
