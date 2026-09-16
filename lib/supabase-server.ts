import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 导出通用的 createClient 方法（客户端、服务端通用，不依赖 next/headers）
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey)
}

// 导出单例实例，方便直接调用
export const supabase = createSupabaseClient(supabaseUrl, supabaseKey)
