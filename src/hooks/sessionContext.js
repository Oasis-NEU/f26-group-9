import { createContext, useContext } from 'react'

export const SessionContext = createContext(null)

// { session, user, profile, attendance, loading, refresh }
export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>')
  return ctx
}
