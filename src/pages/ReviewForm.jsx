import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { getLocationBySlug } from '../services/locations'
import { deletePhoto, getMyReview, submitReview } from '../services/reviews'
import { useAsync } from '../hooks/useAsync'
import { useSession } from '../hooks/sessionContext'
import { CATEGORIES } from '../lib/categories'
import { COMMENT_MAX, COMMENT_MIN, EDIT_COOLDOWN_MS, MAX_PHOTOS } from '../lib/constants'
import StarInput from '../components/StarInput'
import PhotoUploader from '../components/PhotoUploader'
import StatusBanner from '../components/StatusBanner'
import ErrorMessage from '../components/ErrorMessage'
import Spinner from '../components/Spinner'
import NotFound from './NotFound'

async function load(slug, userId) {
  const location = await getLocationBySlug(slug)
  if (!location) return null
  return { location, review: await getMyReview(userId, location.id) }
}

export default function ReviewForm() {
  const { slug } = useParams()
  const { user, attendance } = useSession()
  const { data, error, loading } = useAsync(() => load(slug, user.id), [slug, user.id])

  if (loading) return <Spinner />
  if (error) return <ErrorMessage error={error} />
  if (!data) return <NotFound />
  if (!attendance.some((a) => a.location_id === data.location.id))
    return <Navigate to={`/onboarding?next=${encodeURIComponent(`/campus/${slug}/review`)}`} replace />

  // key resets form state if a different saved review loads
  return <Form key={data.review?.updated_at ?? 'new'} location={data.location} review={data.review} userId={user.id} />
}

function Form({ location, review, userId }) {
  const navigate = useNavigate()
  const [ratings, setRatings] = useState(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c.key, review?.review_ratings.find((r) => r.category === c.key)?.stars ?? null])),
  )
  const [comment, setComment] = useState(review?.comment ?? '')
  const [photos, setPhotos] = useState([]) // new, not yet uploaded: [{ file, url }]
  const [existing, setExisting] = useState(review?.review_photos ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Mirrors the 1-hour edit trigger so users aren't surprised on submit.
  const [now] = useState(() => Date.now())
  const nextEditAt = review ? new Date(review.updated_at).getTime() + EDIT_COOLDOWN_MS : 0
  const coolingDown = review && now < nextEditAt

  const rated = Object.entries(ratings).filter(([, v]) => v !== null)
  const len = comment.trim().length
  const valid = rated.length > 0 && len >= COMMENT_MIN && len <= COMMENT_MAX

  async function handleRemoveExisting(photo) {
    if (!confirm('Remove this photo?')) return
    setError(null)
    try {
      await deletePhoto(photo)
      setExisting((ps) => ps.filter((p) => p.id !== photo.id))
    } catch (err) {
      setError(err)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      await submitReview({
        userId,
        locationId: location.id,
        comment: comment.trim(),
        ratings: Object.fromEntries(rated),
        files: photos.map((p) => p.file),
      })
      navigate(`/campus/${location.slug}`)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link to={`/campus/${location.slug}`} className="text-sm text-gray-500 hover:underline">
          ← {location.name}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{review ? 'Edit your review' : 'Write a review'}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Every submission is checked before it’s published. Edits go back through review, and you can edit once per
          hour.
        </p>
      </div>

      {review && <StatusBanner status={review.status} />}
      {coolingDown && (
        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          You can edit this review again at {new Date(nextEditAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
        </p>
      )}

      <fieldset>
        <legend className="text-lg font-semibold">Ratings</legend>
        <p className="text-sm text-gray-500">Rate at least one category. Mark anything you can’t speak to as N/A.</p>
        <div className="mt-2 divide-y divide-gray-100">
          {CATEGORIES.map(({ key, label }) => (
            <StarInput key={key} label={label} value={ratings[key]} onChange={(v) => setRatings((r) => ({ ...r, [key]: v }))} />
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-lg font-semibold">Your experience</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={7}
          maxLength={COMMENT_MAX}
          placeholder="What should a future student know? Don't include names or personal info about other people."
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-red-700 focus:outline-none"
        />
        <span className={`text-xs ${len > 0 && len < COMMENT_MIN ? 'text-red-700' : 'text-gray-500'}`}>
          {len}/{COMMENT_MAX} · at least {COMMENT_MIN} characters
        </span>
      </label>

      <div>
        <span className="text-lg font-semibold">Photos</span>
        <div className="mt-2">
          <PhotoUploader
            items={photos}
            onChange={setPhotos}
            existing={existing}
            onRemoveExisting={handleRemoveExisting}
          />
        </div>
        {existing.length + photos.length > MAX_PHOTOS && <p className="text-sm text-red-700">Max {MAX_PHOTOS} photos.</p>}
      </div>

      <ErrorMessage error={error} />

      <button
        type="submit"
        disabled={busy || !valid || coolingDown}
        className="w-full rounded-md bg-red-700 px-4 py-2.5 font-medium text-white hover:bg-red-800 disabled:opacity-50"
      >
        {busy ? 'Submitting…' : review ? 'Submit changes' : 'Submit review'}
      </button>
    </form>
  )
}
