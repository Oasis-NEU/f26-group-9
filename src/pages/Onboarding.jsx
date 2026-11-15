import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { listLocationsWithScores } from '../services/locations'
import { addAttendance, removeAttendance } from '../services/attendance'
import { useAsync } from '../hooks/useAsync'
import { useSession } from '../hooks/sessionContext'
import { MAX_CAMPUSES, TERM_SEASONS, termYears } from '../lib/constants'
import { safeNext } from '../lib/safeNext'
import ErrorMessage from '../components/ErrorMessage'
import Spinner from '../components/Spinner'

export default function Onboarding() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const navigate = useNavigate()
  const { user, attendance, refresh } = useSession()
  const locations = useAsync(listLocationsWithScores, [])

  // Preselect the campus from ?next=/campus/<slug>/review when there's room.
  const nextSlug = next.match(/^\/campus\/([^/]+)/)?.[1]
  const [locationId, setLocationId] = useState('')
  const [season, setSeason] = useState('Fall')
  const [years] = useState(termYears)
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const attendedIds = new Set(attendance.map((a) => a.location_id))
  const options = (locations.data ?? []).filter((l) => !attendedIds.has(l.id))
  const preselect = options.find((l) => l.slug === nextSlug)?.id
  const selectedId = locationId || (preselect ? String(preselect) : '')
  const full = attendance.length >= MAX_CAMPUSES

  async function run(fn) {
    setError(null)
    setBusy(true)
    try {
      await fn()
      await refresh()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  function handleAdd(e) {
    e.preventDefault()
    if (!selectedId) return
    run(async () => {
      await addAttendance(user.id, Number(selectedId), `${season} ${year}`)
      setLocationId('')
    })
  }

  const field = 'rounded-md border border-gray-300 px-2 py-2'

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your campuses</h1>
        <p className="mt-1 text-sm text-gray-600">
          List up to {MAX_CAMPUSES} campuses you attended and when you started. You can review only these. Your list is
          private; reviews show just “Verified student · Attended {'{term}'}”.
        </p>
      </div>

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
        {attendance.length === 0 && <li className="p-3 text-sm text-gray-500">No campuses yet.</li>}
        {attendance.map((a) => (
          <li key={a.location_id} className="flex items-center justify-between gap-2 p-3">
            <div>
              <Link to={`/campus/${a.locations.slug}`} className="font-medium hover:underline">
                {a.locations.name}
              </Link>
              <p className="text-sm text-gray-500">Started {a.first_term}</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => removeAttendance(user.id, a.location_id))}
              className="text-sm text-gray-500 hover:text-red-700"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      {locations.loading ? (
        <Spinner />
      ) : full ? (
        <p className="text-sm text-gray-600">You’ve listed the maximum of {MAX_CAMPUSES} campuses.</p>
      ) : (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-48 flex-1 flex-col text-sm font-medium">
            Campus
            <select value={selectedId} onChange={(e) => setLocationId(e.target.value)} required className={`mt-1 ${field}`}>
              <option value="">Choose a campus…</option>
              {options.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.city}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm font-medium">
            Starting term
            <span className="mt-1 flex gap-1">
              <select value={season} onChange={(e) => setSeason(e.target.value)} className={field} aria-label="Season">
                {TERM_SEASONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select value={year} onChange={(e) => setYear(e.target.value)} className={field} aria-label="Year">
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </span>
          </label>
          <button type="submit" disabled={busy || !selectedId} className="rounded-md bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800 disabled:opacity-50">
            Add
          </button>
        </form>
      )}

      <ErrorMessage error={error || locations.error} />

      {attendance.length > 0 && (
        <button
          type="button"
          onClick={() => navigate(next)}
          className="w-full rounded-md border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50"
        >
          Continue
        </button>
      )}
    </div>
  )
}
