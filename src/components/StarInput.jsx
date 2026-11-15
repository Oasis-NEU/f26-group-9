// 1–5 star picker with an N/A option. value: number | null (null = N/A).
export default function StarInput({ label, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex" role="radiogroup" aria-label={label}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              onClick={() => onChange(n)}
              className={`px-0.5 text-2xl leading-none ${value !== null && n <= value ? 'text-amber-500' : 'text-gray-300'} hover:text-amber-400`}
            >
              ★
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded border px-2 py-0.5 text-xs ${value === null ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-300 text-gray-600'}`}
        >
          N/A
        </button>
      </div>
    </div>
  )
}
