import { createClient } from "@supabase/supabase-js"

export function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""

  return createClient(supabaseUrl, supabaseKey)
}

// 兼容不同的函数导出命名
export const createServerClient = getSupabaseServerClient
