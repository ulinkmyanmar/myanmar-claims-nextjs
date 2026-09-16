import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 1. 通用基础客户端实例
export const supabase = createSupabaseClient(supabaseUrl, supabaseKey)

// 2. 导出基础创建函数
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey)
}

// 3. 导出 API 使用的获取客户端函数
export async function getSupabaseServerClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey)
}

// 4. 修复类型报错：补全 AppShell 所需要的 full_name 属性
export async function getCurrentUserProfile() {
  const defaultProfile = {
    id: 'admin',
    name: 'Service Account',
    full_name: 'Service Account',
    email: 'admin@myanmar.com',
    role: 'Admin role',
  }

  try {
    const client = createSupabaseClient(supabaseUrl, supabaseKey)
    const { data: { user } } = await client.auth.getUser()

    if (!user) {
      return defaultProfile
    }

    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || 'Service Account'

    return {
      id: user.id,
      name: fullName,
      full_name: fullName, // 👈 解决 AppShell.tsx(17,29) 报错的关键属性
      email: user.email || 'admin@myanmar.com',
      role: user.user_metadata?.role || 'Admin role',
    }
  } catch (err) {
    return defaultProfile
  }
}
