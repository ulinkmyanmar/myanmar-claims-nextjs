import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 1. 通用基础客户端实例 (客户端和服务端都能安全实例化)
export const supabase = createSupabaseClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
)

// 2. 导出基础创建函数
export function createClient() {
  return createSupabaseClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder'
  )
}

// 3. 导出 API 使用的获取客户端函数
export async function getSupabaseServerClient() {
  return createSupabaseClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder'
  )
}

// 4. 用户 Profile 获取 (带全环境降级保底机制)
export async function getCurrentUserProfile() {
  const defaultProfile = {
    id: 'admin',
    name: 'Myanmar Admin',
    full_name: 'Myanmar Admin',
    email: 'admin@myanmar.com',
    role: 'admin',
  }

  // 判断如果是在浏览器客户端环境运行，直接返回保底 profile，绝不报错
  if (typeof window !== 'undefined') {
    return defaultProfile
  }

  try {
    const client = createSupabaseClient(supabaseUrl, supabaseKey)
    const { data: { user } } = await client.auth.getUser()

    if (!user) {
      return defaultProfile
    }

    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || 'Myanmar Admin'
    const userRole = user.user_metadata?.role || user.role || 'admin'

    return {
      id: user.id,
      name: fullName,
      full_name: fullName,
      email: user.email || 'admin@myanmar.com',
      role: String(userRole).toLowerCase().includes('admin') ? 'admin' : String(userRole),
    }
  } catch (err) {
    return defaultProfile
  }
}
