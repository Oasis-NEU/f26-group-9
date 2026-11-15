import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getModerationQueue, moderateReview } from '../services/reviews'
import { useAsync } from '../hooks/useAsync'
import ReviewCard from '../components/ReviewCard'
import ErrorMessage from '../components/ErrorMessage'
import Spinner from '../components/Spinner'

// "pending" is included so reviews can be approved by hand while the
// moderation backend isn't running (e.g. local dev, demo fallback).
const TABS = ['flagged', 'pending']

export default function AdminModeration() {
  const [tab, setTab] = useState('flagged')
  const { data, error, loading, reload } = useAsync(() => getModerationQueue(tab), [tab])
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function decide(id, decision) {
    setBusyId(id)
    setActionError(null)
    try {
      await moderateReview(id, decision)
      reload()
    } catch (err) {
      setActionError(err)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Moderation</h1>
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm capitalize ${tab === t ? 'border-red-700 font-medium' : 'border-transparent text-gray-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <ErrorMessage error={actionError} />
      {loading && <Spinner />}
      <ErrorMessage error={error} />
      {data?.length === 0 && <p className="text-gray-500">Nothing in the {tab} queue.</p>}

      <div className="space-y-4">
        {data?.map((r) => (
          <ReviewCard
            key={r.id}
            review={r}
            header={
              <div className="mb-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/campus/${r.locations.slug}`} className="font-medium hover:underline">
                    {r.locations.name}
                  </Link>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, 'approved')}
                      className="rounded-md bg-green-700 px-3 py-1 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, 'rejected')}
                      className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
                {r.moderation_notes && (
                  <p className="rounded bg-orange-50 px-2 py-1 text-sm text-orange-900">Flagged: {r.moderation_notes}</p>
                )}
              </div>
            }
          />
        ))}
      </div>
    </div>
  )
}
