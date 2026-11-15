// Read-only star display for a 0–5 value (supports fractions).
export default function Stars({ value, size = 'text-base' }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / 5) * 100))
  return (
    <span className={`relative inline-block leading-none ${size}`} aria-label={`${Number(value).toFixed(1)} out of 5`}>
      <span className="text-gray-300">★★★★★</span>
      <span className="absolute inset-0 overflow-hidden text-amber-500" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  )
}
