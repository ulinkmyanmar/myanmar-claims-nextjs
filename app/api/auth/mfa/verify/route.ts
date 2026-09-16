import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 })

  const { factorId, code } = await req.json().catch(() => ({}))

  if (!factorId || !code) {
    return NextResponse.json({ ok: false, error: 'Verification code is required.' }, { status: 400 })
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })

  if (error) {
    return NextResponse.json({ ok: false, error: 'Invalid verification code.' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
