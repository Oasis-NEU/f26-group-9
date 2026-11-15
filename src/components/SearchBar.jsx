import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SearchBar({ initial = '' }) {
  const [q, setQ] = useState(initial)
  const navigate = useNavigate()
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        navigate(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search')
      }}
      className="flex gap-2"
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by campus, city, or program"
        aria-label="Search campuses"
        className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-red-700 focus:outline-none"
      />
      <button type="submit" className="rounded-md bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800">
        Search
      </button>
    </form>
  )
}
