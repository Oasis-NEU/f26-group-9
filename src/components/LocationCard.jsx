import { Link } from 'react-router-dom'
import { formatScore, pluralize } from '../lib/format'
import Stars from './Stars'

export default function LocationCard({ location }) {
  return (
    <Link
      to={`/campus/${location.slug}`}
      className="group overflow-hidden rounded-lg border border-gray-200 transition hover:border-gray-400"
    >
      <div className="aspect-[16/9] bg-gradient-to-br from-red-700 to-red-900">
        {location.cover_image_url && (
          <img src={location.cover_image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold group-hover:underline">{location.name}</h3>
        <p className="text-sm text-gray-500">
          {location.city}, {location.country}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm">
          {location.review_count > 0 ? (
            <>
              <Stars value={location.overall_avg} size="text-sm" />
              <span className="tabular-nums">{formatScore(location.overall_avg)}</span>
              <span className="text-gray-400">· {pluralize(location.review_count, 'review')}</span>
            </>
          ) : (
            <span className="text-gray-400">No reviews yet</span>
          )}
        </p>
      </div>
    </Link>
  )
}
