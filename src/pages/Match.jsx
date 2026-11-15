import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getCategoryScores, listLocationsWithScores } from '../services/locations'
import { useAsync } from '../hooks/useAsync'
import { CATEGORIES, CATEGORY_LABELS } from '../lib/categories'
import { computeMatches } from '../lib/match'
import { formatScore, pluralize } from '../lib/format'
import Spinner from '../components/Spinner'
import ErrorMessage from '../components/ErrorMessage'

const WEIGHT_LABELS = ['Don’t care', 'A little', 'Somewhat', 'Matters', 'A lot', 'Essential']

async function load() {
  const [locations, scores] = await Promise.all([listLocationsWithScores(), getCategoryScores()])
  return { locations, scores }
}

export default function Match() {
  const { data, error, loading } = useAsync(load, [])
  const [weights, setWeights] = useState(() => Object.fromEntries(CATEGORIES.map((c) => [c.key, 3])))
  const matches = data ? computeMatches(data.locations, data.scores, weights) : []
  const top = matches.slice(0, 3)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Find your match</h1>
        <p className="mt-1 max-w-2xl text-gray-600">
          Tell us what matters to you and we’ll rank campuses by how students rated them in those categories.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
        <fieldset className="space-y-4">
          <legend className="sr-only">Category importance</legend>
          {CATEGORIES.map(({ key, label }) => (
            <label key={key} className="block">
              <span className="flex justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className="text-gray-500">{WEIGHT_LABELS[weights[key]]}</span>
              </span>
              <input
                type="range"
                min={0}
                max={5}
                step={1}
                value={weights[key]}
                onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
                className="mt-1 w-full accent-red-700"
              />
            </label>
          ))}
        </fieldset>

        <section className="space-y-3">
          {loading && <Spinner />}
          <ErrorMessage error={error} />
          {data && top.length === 0 && (
            <p className="text-gray-500">
              Not enough ratings yet for the categories you picked. Try caring about a few more categories.
            </p>
          )}
          {top.map((m, i) => (
            <Link
              key={m.location.id}
              to={`/campus/${m.location.slug}`}
              className="block rounded-lg border border-gray-200 p-4 hover:border-gray-400"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">
                  <span className="mr-2 text-gray-400">#{i + 1}</span>
                  {m.location.name}
                </h2>
                <span className="text-xl font-semibold tabular-nums text-red-700">{formatScore(m.score)}</span>
              </div>
              <p className="text-sm text-gray-500">
                {m.location.city}, {m.location.country} · {pluralize(m.location.review_count, 'review')}
                {m.coverage < 1 && ` · rated in ${Math.round(m.coverage * 100)}% of what you care about`}
              </p>
              {m.why.length > 0 && (
                <p className="mt-2 text-sm text-gray-700">
                  Strong on{' '}
                  {m.why.map((w, j) => (
                    <span key={w.category}>
                      {j > 0 && (j === m.why.length - 1 ? ' and ' : ', ')}
                      <strong>{CATEGORY_LABELS[w.category].toLowerCase()}</strong> ({formatScore(w.avg)})
                    </span>
                  ))}
                  .
                </p>
              )}
            </Link>
          ))}
          {matches.length > 3 && (
            <p className="text-sm text-gray-500">
              {matches.length - 3} more {matches.length - 3 === 1 ? 'campus matches' : 'campuses match'} —{' '}
              <Link to="/search" className="text-red-700 hover:underline">
                browse all
              </Link>
              .
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
