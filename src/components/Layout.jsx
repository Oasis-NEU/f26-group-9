import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/sessionContext'
import { signOut } from '../services/auth'

const navClass = ({ isActive }) =>
  `rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`

export default function Layout() {
  const { user, profile } = useSession()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-svh bg-white text-gray-900">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="text-xl font-semibold tracking-tight">
            NU<span className="text-red-700">where</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/search" className={navClass}>
              Browse
            </NavLink>
            {profile?.is_admin && (
              <NavLink to="/admin/moderation" className={navClass}>
                Moderation
              </NavLink>
            )}
            {user ? (
              <>
                <NavLink to="/me" className={navClass}>
                  My reviews
                </NavLink>
                <button type="button" onClick={handleSignOut} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
                  Sign out
                </button>
              </>
            ) : (
              <NavLink to="/login" className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800">
                Sign in
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
