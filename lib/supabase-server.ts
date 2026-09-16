import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'


// Server-side Supabase client
// Used by Route Handlers and Server Components
// Auth session is stored in httpOnly cookies
export async function getSupabaseServerClient() {

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }


  const cookieStore = await cookies()


  return createServerClient(
    url,
    key,
    {
     

      cookies: {

        getAll() {
          return cookieStore.getAll()
        },


        setAll(cookiesToSet) {

          try {

            cookiesToSet.forEach(
              ({ name, value, options }) =>
                cookieStore.set(
                  name,
                  value,
                  options
                )
            )

          } catch {

            // Cookie updates are handled by middleware
            // when called from Server Components

          }

        },

      },

    }
  )

}



// Returns logged-in user profile
// Used by AppShell for role checking

export async function getCurrentUserProfile() {

  const supabase = await getSupabaseServerClient()

  if (!supabase) {
    return null
  }


  const {
    data: {
      user
    }
  } = await supabase.auth.getUser()


  if (!user) {
    return null
  }


  const {
    data: profile
  } = await supabase
    .from('profiles')
    .select(
      'user_id, full_name, email, role, active'
    )
    .eq(
      'user_id',
      user.id
    )
    .maybeSingle()


  if (!profile || !profile.active) {
    return null
  }


  return profile

}
