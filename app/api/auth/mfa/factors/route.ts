import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

// GET：查看当前账号已绑定的 MFA 因子
export async function GET() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, factors: data.totp })
}

// POST：开始绑定一个新的 TOTP 因子，返回二维码给前端展示
export async function POST() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 })

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    factorId: data.id,
    qrCode: data.totp.qr_code, // 直接是 SVG，可以用 dangerouslySetInnerHTML 或 <img src>
    secret: data.totp.secret,  // 备用：手动输入密钥
  })
}
