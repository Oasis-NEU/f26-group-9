import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listLocationsWithScores } from '../services/locations'
import { backendConfigured, regenerateSummary } from '../services/admin'
import { useAsync } from '../hooks/useAsync'
import { pluralize } from '../lib/format'
import ErrorMessage from './ErrorMessage'
import Spinner from './Spinner'

export default function SummariesPanel() {
  const { data, error, loading } = useAsync(listLocationsWithScores, [])
  const [status, setStatus] = useState({}) // { [locationId]: 'busy' | 'done' | 'unchanged' | Error }

  async function regenerate(id) {
    setStatus((s) => ({ ...s, [id]: 'busy' }))
    try {
      const updated = await regenerateSummary(id)
      setStatus((s) => ({ ...s, [id]: updated ? 'done' : 'unchanged' }))
    } catch (err) {
      setStatus((s) => ({ ...s, [id]: err }))
    }
  }

  if (!backendConfigured)
    return (
      <p className="text-sm text-gray-600">
        Set <code>VITE_BACKEND_URL</code> in <code>.env</code> to regenerate summaries from here, or run{' '}
        <code>python -m app.cli summaries</code> in <code>backend/</code>.
      </p>
    )
  if (loading) return <Spinner />
  if (error) return <ErrorMessage error={error} />

  const reviewed = data.filter((l) => l.review_count > 0)
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600">
        Summaries update automatically. Use this to refresh one now, e.g. before a demo.
      </p>
      {reviewed.length === 0 && <p className="text-gray-500">No campuses have approved reviews yet.</p>}
      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
        {reviewed.map((l) => {
          const st = status[l.id]
          return (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <Link to={`/campus/${l.slug}`} className="font-medium hover:underline">
                  {l.name}
                </Link>
                <p className="text-sm text-gray-500">{pluralize(l.review_count, 'approved review')}</p>
                {st instanceof Error && <p className="text-sm text-red-700">{st.message}</p>}
                {st === 'done' && <p className="text-sm text-green-700">Summary updated.</p>}
                {st === 'unchanged' && <p className="text-sm text-gray-500">Not updated (no approved reviews).</p>}
              </div>
              <button
                type="button"
                disabled={st === 'busy'}
                onClick={() => regenerate(l.id)}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {st === 'busy' ? 'Generating…' : 'Regenerate'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
