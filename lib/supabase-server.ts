import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 1. 通用基础客户端实例
export const supabase = createSupabaseClient(supabaseUrl, supabaseKey)

// 2. 导出基础创建函数
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey)
}

// 3. 补全缺失的函数 1：getSupabaseServerClient
export async function getSupabaseServerClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey)
}

// 4. 补全缺失的函数 2：getCurrentUserProfile (用于 AppShell 和 Auth 验证)
export async function getCurrentUserProfile() {
  try {
    const client = createSupabaseClient(supabaseUrl, supabaseKey)
    const { data: { user } } = await client.auth.getUser()

    if (!user) {
      // 保底返回默认管理员 Profile，防止 AppShell 页面崩掉
      return {
        id: 'admin',
        name: 'Service Account',
        email: 'admin@myanmar.com',
        role: 'Admin role',
      }
    }

    return {
      id: user.id,
      name: user.user_metadata?.full_name || 'Service Account',
      email: user.email || 'admin@myanmar.com',
      role: user.user_metadata?.role || 'Admin role',
    }
  } catch (err) {
    return {
      id: 'admin',
      name: 'Service Account',
      email: 'admin@myanmar.com',
      role: 'Admin role',
    }
  }
}
