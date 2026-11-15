import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile } from '../services/auth'
import { getMyAttendance } from '../services/attendance'
import { SessionContext } from '../hooks/sessionContext'

async function loadUserData(userId) {
  const [profile, attendance] = await Promise.all([getProfile(userId), getMyAttendance(userId)])
  return { userId, profile, attendance }
}

export default function SessionProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = not yet known
  // Tagged with the user it belongs to, so a stale user's data is never shown.
  const [userData, setUserData] = useState({ userId: null, profile: null, attendance: [] })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    // Don't call other Supabase methods inside this callback (supabase-js can
    // deadlock); the effect below reacts to the session change instead.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    loadUserData(userId)
      .then((d) => !cancelled && setUserData(d))
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [userId])

  // Called after the user changes their attendance list.
  const refresh = useCallback(async () => {
    if (userId) setUserData(await loadUserData(userId))
  }, [userId])

  const current = userId && userData.userId === userId
  const value = {
    session,
    user: session?.user ?? null,
    profile: current ? userData.profile : null,
    attendance: current ? userData.attendance : [],
    loading: session === undefined || (!!userId && !current),
    refresh,
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
