// Supabase returns { data, error }; throw so callers can use try/catch.
// Postgres trigger messages (caps, cooldown) are written to be user-facing,
// so pass them through; only browser network failures get rewritten.
const NETWORK_ERROR = /Failed to fetch|NetworkError|Load failed/i

export function unwrap({ data, error }) {
  if (error) {
    const msg = error.message ?? String(error)
    throw new Error(NETWORK_ERROR.test(msg) ? 'Couldn’t reach the server. Check your connection and try again.' : msg)
  }
  return data
}
