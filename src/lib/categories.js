// Must match the rating_category enum in supabase/migrations/…01_types_tables.sql
export const CATEGORIES = [
  { key: 'food', label: 'Food' },
  { key: 'surroundings', label: 'Surroundings' },
  { key: 'social', label: 'Social life' },
  { key: 'education', label: 'Education' },
  { key: 'prices', label: 'Prices' },
  { key: 'dorm', label: 'Dorm' },
  { key: 'campus', label: 'Campus' },
]

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]))
