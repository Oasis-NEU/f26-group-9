// Campus matching (docs/proposal.md §8):
//   match = Σ(weight_c × avg_c) / Σ(weight_c), over categories the campus has ratings for.
// Coverage = share of the user's total weight that the campus has ratings for, so a
// campus rated in only one category you care about doesn't outrank well-rated ones.

export function computeMatches(locations, categoryScores, weights, { minCoverage = 0.5 } = {}) {
  const totalWeight = Object.values(weights).reduce((a, w) => a + w, 0)
  if (totalWeight === 0) return []

  const byLocation = new Map()
  for (const s of categoryScores) {
    if (!byLocation.has(s.location_id)) byLocation.set(s.location_id, new Map())
    byLocation.get(s.location_id).set(s.category, Number(s.avg_stars))
  }

  const results = []
  for (const loc of locations) {
    const scores = byLocation.get(loc.id)
    if (!scores) continue
    let num = 0
    let den = 0
    const contributions = []
    for (const [cat, w] of Object.entries(weights)) {
      if (w <= 0 || !scores.has(cat)) continue
      const avg = scores.get(cat)
      num += w * avg
      den += w
      contributions.push({ category: cat, weight: w, avg })
    }
    if (den === 0) continue
    const coverage = den / totalWeight
    if (coverage < minCoverage) continue
    // "Why": categories you weighted highest where this campus scores well (≥ 4).
    const why = contributions
      .filter((c) => c.avg >= 4)
      .sort((a, b) => b.weight - a.weight || b.avg - a.avg)
      .slice(0, 3)
    results.push({ location: loc, score: num / den, coverage, why })
  }
  return results.sort((a, b) => b.score - a.score || b.coverage - a.coverage)
}
