import { useState } from 'react'
import { reportReview } from '../services/reviews'
import ErrorMessage from './ErrorMessage'

export default function ReportButton({ reviewId, onReported }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-xs text-gray-500 hover:text-red-700">
        Report
      </button>
    )

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await reportReview(reviewId, reason.trim())
      onReported(reviewId)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
      <label className="block text-sm font-medium">
        What’s wrong with this review?
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={500}
          required
          placeholder="e.g. names another student, spam, not about this campus"
          className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-normal"
        />
      </label>
      <p className="text-xs text-gray-500">The review will be hidden until a moderator checks it.</p>
      <ErrorMessage error={error} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || reason.trim().length < 5}
          className="rounded-md bg-red-700 px-3 py-1 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {busy ? 'Reporting…' : 'Report review'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1 text-sm text-gray-600">
          Cancel
        </button>
      </div>
    </form>
  )
}
