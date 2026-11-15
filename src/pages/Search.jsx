import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCategoryScores, listLocationsWithScores, searchLocationsWithScores } from '../services/locations'
import { useAsync } from '../hooks/useAsync'
import { CATEGORIES } from '../lib/categories'
import SearchBar from '../components/SearchBar'
import LocationCard from '../components/LocationCard'
import Spinner from '../components/Spinner'
import ErrorMessage from '../components/ErrorMessage'

const SORTS = {
  ranked: (a, b) => Number(b.ranked_score) - Number(a.ranked_score),
  reviews: (a, b) => b.review_count - a.review_count,
  name: (a, b) => a.name.localeCompare(b.name),
}

export default function Search() {
  const [params] = useSearchParams()
  const q = params.get('q')?.trim() ?? ''
  const [minByCat, setMinByCat] = useState({}) // { social: 4 }
  const [sort, setSort] = useState('ranked')

  const results = useAsync(() => (q ? searchLocationsWithScores(q) : listLocationsWithScores()), [q])
  const catScores = useAsync(() => getCategoryScores(), [])

  // Category filters are applied client-side (docs/proposal.md §4.8).
  const scoreMap = new Map((catScores.data ?? []).map((s) => [`${s.location_id}:${s.category}`, Number(s.avg_stars)]))
  const filters = Object.entries(minByCat).filter(([, v]) => v > 0)
  const visible = (results.data ?? [])
    .filter((l) => filters.every(([cat, min]) => (scoreMap.get(`${l.id}:${cat}`) ?? 0) >= min))
    .sort(SORTS[sort])

  return (
    <div className="space-y-6">
      <div className="max-w-xl">
        <SearchBar key={q} initial={q} />
      </div>
      <h1 className="text-2xl font-semibold">{q ? `Results for “${q}”` : 'All campuses'}</h1>

      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <aside className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium">Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5">
              <option value="ranked">Top rated</option>
              <option value="reviews">Most reviews</option>
              <option value="name">Name</option>
            </select>
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Minimum rating</legend>
            {CATEGORIES.map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-700">{label}</span>
                <select
                  value={minByCat[key] ?? 0}
                  onChange={(e) => setMinByCat((m) => ({ ...m, [key]: Number(e.target.value) }))}
                  className="rounded-md border border-gray-300 px-1.5 py-1"
                >
                  <option value={0}>Any</option>
                  {[2, 3, 4, 4.5].map((n) => (
                    <option key={n} value={n}>
                      {n}+
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
        </aside>

        <section>
          {results.loading && <Spinner />}
          <ErrorMessage error={results.error} />
          {results.data && visible.length === 0 && <p className="text-gray-500">No campuses match.</p>}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((l) => (
              <LocationCard key={l.id} location={l} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
