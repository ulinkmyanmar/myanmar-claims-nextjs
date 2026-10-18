import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase is not configured.' }, { status: 500 })
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ ok: false, error: 'Not authenticated.' }, { status: 401 })

  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, factors: data?.all?.filter(f => f.factor_type === 'totp') ?? data?.totp ?? [] })
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false, error: 'Supabase is not configured.' }, { status: 500 })
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ ok: false, error: 'Not authenticated.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const friendlyName = typeof body?.friendlyName === 'string' ? body.friendlyName.trim() : ''
  if (!friendlyName || friendlyName.length > 60) {
    return NextResponse.json({ ok: false, error: 'Enter a device name (1-60 characters).' }, { status: 400 })
  }

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
  if (listError) return NextResponse.json({ ok: false, error: listError.message }, { status: 500 })
  const existing = (factors?.all ?? factors?.totp ?? []).some(f => f.friendly_name === friendlyName)
  if (existing) return NextResponse.json({ ok: false, error: 'That device name already exists. Choose another name.' }, { status: 409 })

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, factorId: data.id, qrCode: data.totp.qr_code })
}
