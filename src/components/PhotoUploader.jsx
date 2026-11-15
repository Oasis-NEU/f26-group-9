import { MAX_PHOTOS } from '../lib/constants'

// items: new photos picked but not yet uploaded, as [{ file, url }].
// existing: photos already saved on the review.
// Preview URLs are created on pick and revoked on remove (not in an effect
// cleanup, which StrictMode runs early); any left over are freed on page unload.
export default function PhotoUploader({ items, onChange, existing = [], onRemoveExisting }) {
  const remaining = MAX_PHOTOS - existing.length - items.length

  function handlePick(e) {
    const picked = Array.from(e.target.files ?? [])
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, Math.max(0, remaining))
      .map((file) => ({ file, url: URL.createObjectURL(file) }))
    onChange([...items, ...picked])
    e.target.value = ''
  }

  function handleRemove(item) {
    URL.revokeObjectURL(item.url)
    onChange(items.filter((i) => i !== item))
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {existing.map((p) => (
          <Thumb key={p.id} src={p.url} onRemove={() => onRemoveExisting(p)} />
        ))}
        {items.map((item) => (
          <Thumb key={item.url} src={item.url} onRemove={() => handleRemove(item)} />
        ))}
        {remaining > 0 && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400">
            <span className="text-2xl">+</span>
            Add photo
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePick} className="sr-only" />
          </label>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">Up to {MAX_PHOTOS} photos. Location data is removed before upload.</p>
    </div>
  )
}

function Thumb({ src, onRemove }) {
  return (
    <div className="relative">
      <img src={src} alt="" className="aspect-square w-full rounded-md object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove photo"
        className="absolute right-1 top-1 rounded-full bg-black/60 px-2 text-sm text-white hover:bg-black/80"
      >
        ×
      </button>
    </div>
  )
}
