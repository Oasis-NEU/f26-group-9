import { Link, useParams } from 'react-router-dom'
import { getCategoryScores, getLocationBySlug, getLocationScore, getSummary } from '../services/locations'
import { getApprovedReviews, getMyReview } from '../services/reviews'
import { useAsync } from '../hooks/useAsync'
import { useSession } from '../hooks/sessionContext'
import { formatScore, pluralize } from '../lib/format'
import { MAX_CAMPUSES } from '../lib/constants'
import Stars from '../components/Stars'
import CategoryBars from '../components/CategoryBars'
import AISummary from '../components/AISummary'
import ReviewCard from '../components/ReviewCard'
import StatusBanner from '../components/StatusBanner'
import Spinner from '../components/Spinner'
import ErrorMessage from '../components/ErrorMessage'
import NotFound from './NotFound'

async function loadCampus(slug) {
  const location = await getLocationBySlug(slug)
  if (!location) return null
  const [score, categories, summary, reviews] = await Promise.all([
    getLocationScore(location.id),
    getCategoryScores(location.id),
    getSummary(location.id),
    getApprovedReviews(location.id),
  ])
  return { location, score, categories, summary, reviews }
}

export default function Campus() {
  const { slug } = useParams()
  const { user, attendance } = useSession()
  const { data, error, loading } = useAsync(() => loadCampus(slug), [slug])
  const locationId = data?.location?.id
  const mine = useAsync(
    () => (user && locationId ? getMyReview(user.id, locationId) : Promise.resolve(null)),
    [user?.id, locationId],
  )

  if (loading) return <Spinner />
  if (error) return <ErrorMessage error={error} />
  if (!data) return <NotFound />

  const { location, score, categories, summary, reviews } = data
  const reviewCount = Number(score?.review_count ?? 0)
  const attended = attendance.some((a) => a.location_id === location.id)
  const myReview = mine.data
  const others = reviews.filter((r) => r.id !== myReview?.id)

  return (
    <div className="space-y-8">
      <header className="overflow-hidden rounded-xl border border-gray-200">
        <div className="aspect-[3/1] bg-gradient-to-br from-red-700 to-red-900">
          {location.cover_image_url && <img src={location.cover_image_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <h1 className="text-3xl font-semibold">{location.name}</h1>
            <p className="text-gray-500">
              {location.city}, {location.country}
            </p>
            {location.description && <p className="mt-2 max-w-2xl text-gray-700">{location.description}</p>}
          </div>
          <div className="text-right">
            {reviewCount > 0 ? (
              <>
                <div className="flex items-center justify-end gap-2">
                  <Stars value={score.overall_avg} size="text-xl" />
                  <span className="text-2xl font-semibold tabular-nums">{formatScore(score.overall_avg)}</span>
                </div>
                <p className="text-sm text-gray-500">{pluralize(reviewCount, 'review')}</p>
              </>
            ) : (
              <p className="text-gray-500">No reviews yet</p>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <AISummary summary={summary} />

          {myReview && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Your review</h2>
              <StatusBanner status={myReview.status} />
              <ReviewCard review={myReview} />
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Reviews</h2>
            {others.length === 0 && <p className="text-gray-500">No other reviews yet.</p>}
            {others.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </section>
        </div>

        <aside className="space-y-6">
          <WriteReviewCta
            slug={location.slug}
            user={user}
            attended={attended}
            hasReview={!!myReview}
            canAddCampus={attendance.length < MAX_CAMPUSES}
          />
          {categories.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Ratings by category</h2>
              <CategoryBars rows={categories} />
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function WriteReviewCta({ slug, user, attended, hasReview, canAddCampus }) {
  const btn = 'block rounded-md bg-red-700 px-4 py-2 text-center font-medium text-white hover:bg-red-800'
  const reviewPath = `/campus/${slug}/review`
  if (!user)
    return (
      <Link to={`/login?next=${encodeURIComponent(reviewPath)}`} className={btn}>
        Sign in to write a review
      </Link>
    )
  if (attended)
    return (
      <Link to={reviewPath} className={btn}>
        {hasReview ? 'Edit your review' : 'Write a review'}
      </Link>
    )
  return (
    <p className="rounded-md border border-gray-200 p-3 text-sm text-gray-600">
      You can only review campuses you attended.{' '}
      {canAddCampus && (
        <Link to={`/onboarding?next=${encodeURIComponent(reviewPath)}`} className="text-red-700 underline">
          Add this campus to your list
        </Link>
      )}
    </p>
  )
}
