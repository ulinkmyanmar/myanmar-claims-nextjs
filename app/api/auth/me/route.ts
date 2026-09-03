import { NextResponse } from 'next/server'
import { getCurrentUserProfile } from '@/lib/supabase-server'

export async function GET() {
  const profile = await getCurrentUserProfile()
  if (!profile) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true, profile })
}
