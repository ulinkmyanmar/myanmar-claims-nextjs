import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createSupabaseClient(supabaseUrl, supabaseKey)

export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey)
}

export async function getSupabaseServerClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey)
}

export async function getCurrentUserProfile() {
  const defaultProfile = {
    id: 'admin',
    name: 'Myanmar Admin',
    full_name: 'Myanmar Admin',
    email: 'admin@myanmar.com',
    role: 'admin', // 👈 关键点：改为 'admin'，触发侧边栏显示 Database Management
  }

  try {
    const client = createSupabaseClient(supabaseUrl, supabaseKey)
    const { data: { user } } = await client.auth.getUser()

    if (!user) {
      return defaultProfile
    }

    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || 'Myanmar Admin'
    // 优先读取用户真实角色，如果未读取到直接给 'admin'
    const role = user.user_metadata?.role || user.role || 'admin'

    return {
      id: user.id,
      name: fullName,
      full_name: fullName,
      email: user.email || 'admin@myanmar.com',
      role: role.toLowerCase().includes('admin') ? 'admin' : role,
    }
  } catch (err) {
    return defaultProfile
  }
}
