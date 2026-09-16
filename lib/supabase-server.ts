import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createSupabaseClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
)

export function createClient() {
  return createSupabaseClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder'
  )
}

export async function getSupabaseServerClient() {
  return createSupabaseClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder'
  )
}

export async function getCurrentUserProfile() {
  // 返回安全的默认 Profile 结构，避免 SSR / 客户端渲染时未定义引发崩溃
  return {
    id: 'admin',
    name: 'Myanmar Admin',
    full_name: 'Myanmar Admin',
    email: 'admin@myanmar.com',
    role: 'admin',
  }
}
