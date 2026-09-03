import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_PATHS = ['/login']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))

  // If Supabase isn't configured yet, don't lock the developer out of the
  // whole app — but still keep them off protected pages until it is, since
  // there is no way to verify a password without it.
  if (!url || !key) {
    if (!isPublicPath) return NextResponse.redirect(new URL('/login', request.url))
    return response
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // Re-validates the session against Supabase Auth on every request (this is
  // the "is this user actually still logged in" check, done server-side).
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && isPublicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
