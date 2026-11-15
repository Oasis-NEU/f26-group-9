import { supabase } from '../lib/supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '')

export const backendConfigured = Boolean(BACKEND_URL)

// Calls the FastAPI backend with the admin's Supabase JWT (backend checks is_admin).
export async function regenerateSummary(locationId) {
  if (!BACKEND_URL) throw new Error('Set VITE_BACKEND_URL to use this.')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in again.')
  let res
  try {
    res = await fetch(`${BACKEND_URL}/admin/summaries/${locationId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new Error('Couldn’t reach the backend.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.detail ?? `Backend error ${res.status}`)
  return body.updated
}
