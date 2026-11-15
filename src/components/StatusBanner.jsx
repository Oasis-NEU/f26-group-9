const MESSAGES = {
  pending: ['bg-amber-50 border-amber-200 text-amber-900', 'Your review is being checked. Only you can see it until it’s approved.'],
  flagged: ['bg-orange-50 border-orange-200 text-orange-900', 'Your review was flagged and is waiting for a moderator.'],
  rejected: ['bg-red-50 border-red-200 text-red-900', 'Your review wasn’t published. You can edit it and resubmit.'],
  approved: ['bg-green-50 border-green-200 text-green-900', 'Your review is published.'],
}

export default function StatusBanner({ status }) {
  const entry = MESSAGES[status]
  if (!entry) return null
  return <p className={`rounded-md border px-3 py-2 text-sm ${entry[0]}`}>{entry[1]}</p>
}
