import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Server-side Supabase client for use inside Route Handlers and Server
// Components. Reads/writes the auth session via httpOnly cookies, so the
// actual username/password check always happens on the server (Supabase
// Auth), never in the browser.
export async function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  const cookieStore = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // setAll can be called from a Server Component where cookies are
          // read-only; middleware.ts is what actually refreshes the session
          // in that case, so this is safe to ignore.
        }
      },
    },
  })
}

// Returns the signed-in user's auth identity plus their `profiles` row
// (role, active flag). Returns null if not logged in, not configured, or
// the profile record is missing/inactive.
export async function getCurrentUserProfile() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, full_name, email, role, active')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile || !profile.active) return null
  return profile
}
