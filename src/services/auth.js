import { supabase } from '../lib/supabase'
import { unwrap } from './unwrap'

export function isNuEmail(email) {
  return /^[^\s@]+@northeastern\.edu$/i.test(email.trim())
}

export async function requestCode(email) {
  unwrap(await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } }))
}

export async function verifyCode(email, token) {
  return unwrap(await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' }))
}

export async function signOut() {
  unwrap(await supabase.auth.signOut())
}

export async function getProfile(userId) {
  return unwrap(await supabase.from('profiles').select('id, email, is_admin').eq('id', userId).maybeSingle())
}
