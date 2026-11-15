export default function ErrorMessage({ error }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {error.message ?? String(error)}
    </p>
  )
}
