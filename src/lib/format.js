export function formatScore(value) {
  if (value === null || value === undefined) return '—'
  return Number(value).toFixed(1)
}

export function pluralize(n, word) {
  return `${n} ${word}${Number(n) === 1 ? '' : 's'}`
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
