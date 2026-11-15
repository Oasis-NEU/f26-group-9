import { CATEGORIES } from '../lib/categories'
import { formatScore } from '../lib/format'

// rows: [{ category, avg_stars, rating_count }]
export default function CategoryBars({ rows }) {
  const byCat = new Map(rows.map((r) => [r.category, r]))
  const present = CATEGORIES.filter((c) => byCat.has(c.key))
  if (present.length === 0) return null
  return (
    <dl className="space-y-2">
      {present.map(({ key, label }) => {
        const r = byCat.get(key)
        return (
          <div key={key} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
            <dt className="text-gray-700">{label}</dt>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-red-700" style={{ width: `${(Number(r.avg_stars) / 5) * 100}%` }} />
            </div>
            <dd className="w-20 text-right tabular-nums text-gray-600">
              {formatScore(r.avg_stars)} <span className="text-gray-400">· {r.rating_count}</span>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
