// UX mirrors of limits enforced in Postgres (triggers / constraints).
export const MAX_CAMPUSES = 3
export const MAX_PHOTOS = 4
export const COMMENT_MIN = 20
export const COMMENT_MAX = 3000
export const EDIT_COOLDOWN_MS = 60 * 60 * 1000
export const PHOTO_BUCKET = 'review-photos'

export const TERM_SEASONS = ['Fall', 'Spring', 'Summer']

export function termYears() {
  const now = new Date().getFullYear()
  const years = []
  for (let y = now + 1; y >= now - 8; y--) years.push(y)
  return years
}
