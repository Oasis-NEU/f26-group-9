import { supabase } from '../lib/supabase'
import { PHOTO_BUCKET } from '../lib/constants'
import { toCleanWebp } from '../lib/toCleanWebp'
import { unwrap } from './unwrap'

const REVIEW_COLUMNS =
  'id, location_id, attended_term, comment, status, moderation_notes, created_at, updated_at, review_ratings(category, stars), review_photos(id, storage_path)'

// The bucket is private; storage RLS decides who can sign which photos.
async function withPhotoUrls(reviews) {
  const paths = reviews.flatMap((r) => r.review_photos.map((p) => p.storage_path))
  if (paths.length === 0) return reviews
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60)
  if (error) return reviews
  const urls = new Map(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
  return reviews.map((r) => ({
    ...r,
    review_photos: r.review_photos.map((p) => ({ ...p, url: urls.get(p.storage_path) })).filter((p) => p.url),
  }))
}

export async function getApprovedReviews(locationId) {
  const rows = unwrap(
    await supabase
      .from('reviews')
      .select(REVIEW_COLUMNS)
      .eq('location_id', locationId)
      .eq('status', 'approved')
      .order('updated_at', { ascending: false }),
  )
  return withPhotoUrls(rows)
}

export async function getMyReview(userId, locationId) {
  const row = unwrap(
    await supabase.from('reviews').select(REVIEW_COLUMNS).eq('user_id', userId).eq('location_id', locationId).maybeSingle(),
  )
  if (!row) return null
  return (await withPhotoUrls([row]))[0]
}

export async function getMyReviews(userId) {
  return unwrap(
    await supabase
      .from('reviews')
      .select('id, status, comment, attended_term, updated_at, locations(slug, name)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  )
}

// Upload photos first, then link them in submit_review so moderation always
// sees the final set of photos (see docs/proposal.md §4.3).
export async function submitReview({ userId, locationId, comment, ratings, files }) {
  const storage = supabase.storage.from(PHOTO_BUCKET)
  const uploaded = []
  try {
    for (const file of files) {
      const blob = await toCleanWebp(file)
      const path = `${userId}/${crypto.randomUUID()}.webp`
      unwrap(await storage.upload(path, blob, { contentType: 'image/webp' }))
      uploaded.push(path)
    }
    return unwrap(
      await supabase.rpc('submit_review', {
        p_location_id: locationId,
        p_comment: comment,
        p_ratings: ratings,
        p_photo_paths: uploaded,
      }),
    )
  } catch (err) {
    if (uploaded.length) await storage.remove(uploaded)
    throw err
  }
}

export async function deletePhoto(photo) {
  const rows = unwrap(await supabase.from('review_photos').delete().eq('id', photo.id).select())
  if (rows.length === 0) throw new Error('Could not remove photo.')
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path])
}

export async function getModerationQueue(status) {
  const rows = unwrap(
    await supabase
      .from('reviews')
      .select(`${REVIEW_COLUMNS}, locations(slug, name)`)
      .eq('status', status)
      .order('updated_at', { ascending: true }),
  )
  return withPhotoUrls(rows)
}

export async function moderateReview(reviewId, decision) {
  unwrap(await supabase.rpc('moderate_review', { p_review_id: reviewId, p_decision: decision }))
}
