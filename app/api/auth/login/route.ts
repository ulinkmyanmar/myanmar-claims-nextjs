import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getSupabaseServerClient } from '@/lib/supabase-server'


const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),

  password: z
    .string()
    .min(1, 'Password is required'),
})


export async function POST(req: Request) {

  const supabase =
    await getSupabaseServerClient()


  // --------------------------------------------------
  // Supabase configuration check
  // --------------------------------------------------

  if (!supabase) {

    return NextResponse.json(
      {
        ok: false,
        error:
          'Authentication is not configured on the server yet.',
      },
      {
        status: 500,
      }
    )
  }


  // --------------------------------------------------
  // Validate request
  // --------------------------------------------------

  const body =
    await req.json().catch(() => null)

  const parsed =
    loginSchema.safeParse(body)


  if (!parsed.success) {

    return NextResponse.json(
      {
        ok: false,
        error:
          parsed.error.issues[0]?.message ??
          'Invalid request',
      },
      {
        status: 400,
      }
    )
  }


  const {
    email,
    password,
  } = parsed.data


  // --------------------------------------------------
  // Authenticate with Supabase
  // --------------------------------------------------

  const {
    data,
    error,
  } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    })


  if (error || !data.user) {

    return NextResponse.json(
      {
        ok: false,
        error:
          'Incorrect email or password.',
      },
      {
        status: 401,
      }
    )
  }


  // --------------------------------------------------
  // Check authorized active profile
  // --------------------------------------------------

  const {
    data: profile,
  } =
    await supabase
      .from('profiles')
      .select(
        'role, active, full_name'
      )
      .eq(
        'user_id',
        data.user.id
      )
      .maybeSingle()


  // --------------------------------------------------
  // Reject inactive / unauthorized account
  // --------------------------------------------------

  if (
    !profile ||
    !profile.active
  ) {

    await supabase.auth.signOut()


    return NextResponse.json(
      {
        ok: false,
        error:
          'This account is not authorized to access this system.',
      },
      {
        status: 403,
      }
    )
  }


  // --------------------------------------------------
  // Record successful login
  // --------------------------------------------------

  const loginTime =
    new Date().toISOString()


  const {
    error: loginLogError,
  } =
    await supabase
      .from('mcs_login_logs')
      .insert({
        user_id: data.user.id,

        email:
          data.user.email ??
          email,

        full_name:
          profile.full_name,

        login_time:
          loginTime,

        login_status:
          'SUCCESS',

        CreatedDateTime:
          loginTime,

        CreatedByUser:
          data.user.email ??
          email,

        ModifiedDateTime:
          loginTime,

        ModifiedByUser:
          data.user.email ??
          email,
      })


  // --------------------------------------------------
  // Do NOT block login if audit logging fails
  // --------------------------------------------------

  if (loginLogError) {

    console.error(
      'Failed to record login:',
      loginLogError
    )

  }


  // --------------------------------------------------
  // Login successful
  // --------------------------------------------------

  return NextResponse.json({
    ok: true,
    role: profile.role,
    fullName: profile.full_name,
  })
}
