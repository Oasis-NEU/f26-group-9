import { listLocationsWithScores } from '../services/locations'
import { useAsync } from '../hooks/useAsync'
import SearchBar from '../components/SearchBar'
import LocationCard from '../components/LocationCard'
import Spinner from '../components/Spinner'
import ErrorMessage from '../components/ErrorMessage'

export default function Home() {
  const { data, error, loading } = useAsync(listLocationsWithScores, [])
  const top = (data ?? [])
    .filter((l) => l.review_count > 0)
    .sort((a, b) => Number(b.ranked_score) - Number(a.ranked_score))
    .slice(0, 6)

  return (
    <div className="space-y-10">
      <section className="space-y-4 py-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Where should you go next?</h1>
        <p className="max-w-2xl text-gray-600">
          Honest, category-by-category ratings of Northeastern campuses, NUin, and Dialogue locations — written by
          verified students who were actually there.
        </p>
        <div className="max-w-xl">
          <SearchBar />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Top-rated campuses</h2>
        {loading && <Spinner />}
        <ErrorMessage error={error} />
        {data && top.length === 0 && <p className="text-gray-500">No reviews yet — be the first to write one.</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((l) => (
            <LocationCard key={l.id} location={l} />
          ))}
        </div>
      </section>
    </div>
  )
}
