import { Link } from 'react-router-dom'
import { getMyReviews } from '../services/reviews'
import { useAsync } from '../hooks/useAsync'
import { useSession } from '../hooks/sessionContext'
import { formatDate } from '../lib/format'
import ErrorMessage from '../components/ErrorMessage'
import Spinner from '../components/Spinner'

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-900',
  approved: 'bg-green-100 text-green-900',
  flagged: 'bg-orange-100 text-orange-900',
  rejected: 'bg-red-100 text-red-900',
}

export default function Me() {
  const { user, attendance } = useSession()
  const { data, error, loading } = useAsync(() => getMyReviews(user.id), [user.id])
  const reviewedIds = new Set((data ?? []).map((r) => r.locations.slug))

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">My reviews</h1>
        <p className="text-sm text-gray-500">{user.email}</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Campuses I attended</h2>
          <Link to="/onboarding?next=/me" className="text-sm text-red-700 hover:underline">
            Manage
          </Link>
        </div>
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
          {attendance.length === 0 && <li className="p-3 text-sm text-gray-500">None yet.</li>}
          {attendance.map((a) => (
            <li key={a.location_id} className="flex items-center justify-between gap-2 p-3">
              <div>
                <Link to={`/campus/${a.locations.slug}`} className="font-medium hover:underline">
                  {a.locations.name}
                </Link>
                <p className="text-sm text-gray-500">Started {a.first_term}</p>
              </div>
              {!reviewedIds.has(a.locations.slug) && (
                <Link to={`/campus/${a.locations.slug}/review`} className="text-sm text-red-700 hover:underline">
                  Write review
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reviews</h2>
        {loading && <Spinner />}
        <ErrorMessage error={error} />
        {data?.length === 0 && <p className="text-sm text-gray-500">You haven’t written any reviews yet.</p>}
        {data?.map((r) => (
          <article key={r.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to={`/campus/${r.locations.slug}`} className="font-medium hover:underline">
                {r.locations.name}
              </Link>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>
                {r.status}
              </span>
            </div>
            <p className="mt-2 line-clamp-3 text-sm text-gray-700">{r.comment}</p>
            <div className="mt-2 flex justify-between text-xs text-gray-500">
              <span>Updated {formatDate(r.updated_at)}</span>
              <Link to={`/campus/${r.locations.slug}/review`} className="text-red-700 hover:underline">
                Edit
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
