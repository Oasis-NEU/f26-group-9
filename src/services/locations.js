import { supabase } from '../lib/supabase'
import { unwrap } from './unwrap'

const LOCATION_COLUMNS = 'id, slug, name, city, country, description, cover_image_url'

function mergeScores(locations, scores) {
  const byId = new Map(scores.map((s) => [s.location_id, s]))
  return locations.map((l) => {
    const s = byId.get(l.id)
    return {
      ...l,
      review_count: Number(s?.review_count ?? 0),
      overall_avg: s?.overall_avg ?? null,
      ranked_score: s?.ranked_score ?? null,
    }
  })
}

// The campus list is small (tens of rows), so fetch everything and merge client-side.
export async function listLocationsWithScores() {
  const [locations, scores] = await Promise.all([
    supabase.from('locations').select(LOCATION_COLUMNS).order('name').then(unwrap),
    supabase.from('location_scores').select('*').then(unwrap),
  ])
  return mergeScores(locations, scores)
}

export async function searchLocationsWithScores(q) {
  const [locations, scores] = await Promise.all([
    supabase.rpc('search_locations', { q }).select(LOCATION_COLUMNS).then(unwrap),
    supabase.from('location_scores').select('*').then(unwrap),
  ])
  return mergeScores(locations, scores)
}

export async function getLocationBySlug(slug) {
  return unwrap(await supabase.from('locations').select(LOCATION_COLUMNS).eq('slug', slug).maybeSingle())
}

export async function getLocationScore(locationId) {
  return unwrap(await supabase.from('location_scores').select('*').eq('location_id', locationId).maybeSingle())
}

// Returns rows { location_id, category, avg_stars, rating_count }.
export async function getCategoryScores(locationId) {
  let query = supabase.from('location_category_scores').select('*')
  if (locationId) query = query.eq('location_id', locationId)
  return unwrap(await query)
}

export async function getSummary(locationId) {
  return unwrap(
    await supabase.from('location_summaries').select('summary, review_count, updated_at').eq('location_id', locationId).maybeSingle(),
  )
}
