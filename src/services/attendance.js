import { supabase } from '../lib/supabase'
import { unwrap } from './unwrap'

export async function getMyAttendance(userId) {
  return unwrap(
    await supabase
      .from('user_locations')
      .select('location_id, first_term, created_at, locations(slug, name, city, country)')
      .eq('user_id', userId)
      .order('created_at'),
  )
}

export async function addAttendance(userId, locationId, firstTerm) {
  unwrap(await supabase.from('user_locations').insert({ user_id: userId, location_id: locationId, first_term: firstTerm }))
}

export async function removeAttendance(userId, locationId) {
  const rows = unwrap(
    await supabase.from('user_locations').delete().eq('user_id', userId).eq('location_id', locationId).select(),
  )
  // RLS silently skips the delete if the campus has a review.
  if (rows.length === 0) throw new Error("You can't remove a campus you've already reviewed.")
}
