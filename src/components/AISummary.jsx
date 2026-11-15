import { CATEGORIES } from '../lib/categories'
import { pluralize } from '../lib/format'

export default function AISummary({ summary }) {
  if (!summary) return null
  const { overview, categories = {} } = summary.summary ?? {}
  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        AI summary · based on {pluralize(summary.review_count, 'review')}
      </p>
      {overview && <p className="text-gray-800">{overview}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {CATEGORIES.filter((c) => categories[c.key]).map(({ key, label }) => {
          const { pros = [], cons = [] } = categories[key]
          return (
            <div key={key} className="text-sm">
              <h4 className="font-medium">{label}</h4>
              <ul className="mt-1 space-y-0.5">
                {pros.map((p) => (
                  <li key={`p-${p}`} className="text-green-800">+ {p}</li>
                ))}
                {cons.map((c) => (
                  <li key={`c-${c}`} className="text-red-800">− {c}</li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
