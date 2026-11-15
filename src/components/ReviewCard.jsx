import { CATEGORY_LABELS, CATEGORIES } from '../lib/categories'
import { formatDate } from '../lib/format'
import Stars from './Stars'

const order = Object.fromEntries(CATEGORIES.map((c, i) => [c.key, i]))

// No names or emails, ever — only the attended term.
export default function ReviewCard({ review, header }) {
  const ratings = [...review.review_ratings].sort((a, b) => order[a.category] - order[b.category])
  return (
    <article className="rounded-lg border border-gray-200 p-4">
      {header}
      <p className="text-sm text-gray-500">
        Verified student · Attended {review.attended_term} · {formatDate(review.updated_at)}
      </p>
      {ratings.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {ratings.map((r) => (
            <li key={r.category} className="flex items-center gap-1">
              <span className="text-gray-600">{CATEGORY_LABELS[r.category]}</span>
              <Stars value={r.stars} size="text-sm" />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 whitespace-pre-line text-gray-800">{review.comment}</p>
      {review.review_photos?.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {review.review_photos.map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
              <img src={p.url} alt="" loading="lazy" className="aspect-square w-full rounded-md object-cover" />
            </a>
          ))}
        </div>
      )}
    </article>
  )
}
