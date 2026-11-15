import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '../hooks/sessionContext'
import Spinner from './Spinner'

// Route guard. UX only — RLS is what actually protects the data.
export default function AuthGate({ children, requireOnboarded = false, requireAdmin = false }) {
  const { user, profile, attendance, loading } = useSession()
  const location = useLocation()
  const here = location.pathname + location.search

  if (loading) return <Spinner />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(here)}`} replace />
  if (requireOnboarded && attendance.length === 0)
    return <Navigate to={`/onboarding?next=${encodeURIComponent(here)}`} replace />
  if (requireAdmin && !profile?.is_admin) return <Navigate to="/" replace />
  return children
}
