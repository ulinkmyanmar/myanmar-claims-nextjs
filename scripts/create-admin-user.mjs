// One-off setup script: creates (or promotes) an admin account in Supabase
// Auth so there is a real username/password the login page can check.
//
// Usage:
//   node --env-file=.env.local scripts/create-admin-user.mjs <email> <password> "<Full Name>"
//
// Requires SUPABASE_SERVICE_ROLE_KEY (server-only secret — never expose
// this in the browser or commit it to git) plus NEXT_PUBLIC_SUPABASE_URL.

import { createClient } from '@supabase/supabase-js'

const [, , email, password, fullName] = process.argv

if (!email || !password) {
  console.error('Usage: node --env-file=.env.local scripts/create-admin-user.mjs <email> <password> "<Full Name>"')
  process.exit(1)
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

async function main() {
  // Create the Auth user. Supabase hashes and stores the password itself —
  // this script never stores the plaintext password anywhere.
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName ?? email },
  })

  let userId = created?.user?.id

  if (createError) {
    if (!createError.message.includes('already been registered')) {
      console.error('Failed to create user:', createError.message)
      process.exit(1)
    }
    // User already exists — look it up so we can still promote to admin.
    const { data: list, error: listError } = await supabase.auth.admin.listUsers()
    if (listError) {
      console.error('Failed to look up existing user:', listError.message)
      process.exit(1)
    }
    const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (!existing) {
      console.error('User already registered but could not be found to promote.')
      process.exit(1)
    }
    userId = existing.id
    console.log(`User ${email} already exists — updating role to admin instead.`)
  } else {
    console.log(`Created auth user ${email}.`)
  }

  // Ensure the profiles row exists with role='admin' and active=true,
  // overriding whatever the default new-user trigger set.
  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(
      { user_id: userId, full_name: fullName ?? email, email, role: 'admin', active: true },
      { onConflict: 'user_id' }
    )

  if (upsertError) {
    console.error('Failed to upsert profile row:', upsertError.message)
    process.exit(1)
  }

  console.log(`✅ ${email} is now an active admin. You can log in with this email and password.`)
}

main()
