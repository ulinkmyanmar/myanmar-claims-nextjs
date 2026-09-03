import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseServerClient } from '@/lib/supabase-server'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'Authentication is not configured on the server yet.' },
      { status: 500 }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    )
  }

  const { email, password } = parsed.data

  // This is the actual backend check: Supabase Auth verifies the email +
  // password against the hashed credential it stores server-side. Nothing
  // about "is this password correct" is ever decided in the browser.
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: 'Incorrect email or password.' }, { status: 401 })
  }

  // Credential was valid — now confirm the account is an authorized,
  // active profile for this system before letting the session stand.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, active, full_name')
    .eq('user_id', data.user.id)
    .maybeSingle()

  if (!profile || !profile.active) {
    await supabase.auth.signOut()
    return NextResponse.json(
      { ok: false, error: 'This account is not authorized to access this system.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true, role: profile.role, fullName: profile.full_name })
}
