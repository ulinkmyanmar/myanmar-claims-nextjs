import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUserProfile, getSupabaseServerClient } from '@/lib/supabase-server'

const recordSchema = z.object({
  claimNo: z.string().trim().min(1),
  clientName: z.string(),
  dateOfBirth: z.string().nullable(),
  gender: z.string(),
  incidentDate: z.string().nullable(),
  description: z.string(),
  _status: z.enum(['NEW_RECORD', 'EXISTING_UPDATE', 'UNCHANGED', 'DUPLICATE']),
  _existingValues: z.object({
    client_name: z.unknown(), date_of_birth: z.unknown(), gender: z.unknown(),
    incident_date: z.unknown(), description: z.unknown(),
  }).optional(),
})
const requestSchema = z.object({
  version: z.string().trim().min(1).max(200),
  coverageDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  records: z.array(recordSchema).min(1).max(10000),
})

export async function POST(request: Request) {
  // Keep writes disabled until SQL migration, authorization and staging tests are verified.
  if (process.env.ENABLE_CLAIMS_SYNC !== 'true') {
    return NextResponse.json({ error: 'Claims synchronization is not enabled in this environment.' }, { status: 503 })
  }

  const profile = await getCurrentUserProfile()
  if (!profile) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  if (String(profile.role).toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 })
  }

  const supabase = await getSupabaseServerClient()
  if (!supabase) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 })
  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (assuranceError || (assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2')) {
    return NextResponse.json({ error: 'Complete MFA verification before synchronization.' }, { status: 403 })
  }

  const input = requestSchema.safeParse(await request.json().catch(() => null))
  if (!input.success) return NextResponse.json({ error: 'Invalid synchronization request.' }, { status: 400 })
  if (input.data.records.some((r) => r._status === 'DUPLICATE')) {
    return NextResponse.json({ error: 'Resolve duplicate claims before synchronization.' }, { status: 409 })
  }
  if (!input.data.records.some((r) => r._status === 'NEW_RECORD' || r._status === 'EXISTING_UPDATE')) {
    return NextResponse.json({ error: 'No new or changed records to synchronize.' }, { status: 400 })
  }

  // Elevated credentials are only used after session, active-admin and MFA checks.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server-side synchronization credentials are missing.' }, { status: 500 })
  }
  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // The RPC revalidates all records and performs claims + history writes atomically.
  const { data, error } = await adminClient.schema('MyanmarClaimSystem').rpc('apply_claims_sync', {
    p_version: input.data.version,
    p_coverage_date: input.data.coverageDate,
    p_records: input.data.records,
    p_actor_id: profile.id,
  })
  if (error) {
    console.error('Claims sync RPC failed:', error)
    return NextResponse.json({ error: 'Synchronization was rejected. Revalidate the upload and check server logs.' }, { status: 409 })
  }
  return NextResponse.json({ success: true, ...data })
}
