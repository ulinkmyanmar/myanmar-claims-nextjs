import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 供 API Routes 使用：基于 cookie 的服务端客户端，
// 登录/登出/MFA 校验都要用这个，才能和 middleware.ts 共享同一个 session
export async function getSupabaseServerClient() {
  if (!supabaseUrl || !supabaseKey) return null

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // 在某些 Server Component 场景下无法写 cookie，可以忽略
        }
      },
    },
  })
}

// 保留：给一些不需要 session、只做只读查询的地方用（如 dashboard 统计）
export function createClient() {
  return createSupabaseClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder'
  )
}

export async function getCurrentUserProfile() {
  const supabase = await getSupabaseServerClient()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, active, full_name, email')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile || !profile.active) return null

  return {
    id: user.id,
    name: profile.full_name,
    full_name: profile.full_name,
    email: profile.email || user.email || '',
    role: profile.role,
  }
}
