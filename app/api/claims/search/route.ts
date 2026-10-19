import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

const SCHEMA = 'MyanmarClaimSystem'
const MAX_MEMBERS = 200
const PAGE_SIZE = 500

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseServerClient()
    if (!supabase) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

    const params = new URL(request.url).searchParams
    const name = (params.get('name') ?? '').trim()
    const dob = (params.get('dob') ?? '').trim()
    const gender = (params.get('gender') ?? '').trim()
    const keyword = (params.get('q') ?? '').trim() // Preserve existing ?q= deep links.

    if (!name && !dob && !gender && !keyword) {
      return NextResponse.json({ error: 'Enter at least one search field.' }, { status: 400 })
    }
    if ([name, dob, gender, keyword].some(value => value.length > 200)) {
      return NextResponse.json({ error: 'Search input is too long.' }, { status: 400 })
    }
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return NextResponse.json({ error: 'Date of birth must be YYYY-MM-DD.' }, { status: 400 })
    }
    if (gender && !['Male', 'Female'].includes(gender)) {
      return NextResponse.json({ error: 'Invalid gender.' }, { status: 400 })
    }

    // Identity is defined by mcs_members.id, never by demographic grouping.
    // Query 201 rows so broad searches cannot silently return a partial result.
    let memberQuery = supabase.schema(SCHEMA).from('mcs_members')
      .select('id,client_name,date_of_birth,gender').order('id').limit(MAX_MEMBERS + 1)
    if (name) memberQuery = memberQuery.ilike('client_name', `%${name.replace(/[%_]/g, '')}%`)
    if (dob) memberQuery = memberQuery.eq('date_of_birth', dob)
    if (gender) memberQuery = memberQuery.eq('gender', gender)
    if (keyword) memberQuery = memberQuery.ilike('client_name', `%${keyword.replace(/[%_]/g, '')}%`)

    const { data: matchingMembers, error: memberError } = await memberQuery
    if (memberError) throw new Error(memberError.message)

    // For legacy keyword deep links, also support finding a member by claim number.
    const memberMap = new Map<number, { id: number; client_name: string; date_of_birth: string | null; gender: string | null }>()
    for (const member of matchingMembers ?? []) memberMap.set(Number(member.id), member)
    if (keyword) {
      const { data: claimMatches, error: matchError } = await supabase.schema(SCHEMA)
        .from('mcs_claims').select('member_id')
        .ilike('claim_no', `%${keyword.replace(/[%_]/g, '')}%`).limit(MAX_MEMBERS + 1)
      if (matchError) throw new Error(matchError.message)
      const ids = [...new Set((claimMatches ?? []).map(c => Number(c.member_id)).filter(Boolean))]
      const missingIds = ids.filter(id => !memberMap.has(id))
      if (missingIds.length) {
        const { data: extra, error: extraError } = await supabase.schema(SCHEMA).from('mcs_members')
          .select('id,client_name,date_of_birth,gender').in('id', missingIds)
        if (extraError) throw new Error(extraError.message)
        for (const member of extra ?? []) memberMap.set(Number(member.id), member)
      }
    }

    if ((matchingMembers?.length ?? 0) > MAX_MEMBERS || memberMap.size > MAX_MEMBERS) {
      return NextResponse.json({ error: 'Too many matching members. Narrow your search using Name or Date of Birth.' }, { status: 400 })
    }
    const ids = [...memberMap.keys()]
    if (ids.length === 0) return NextResponse.json({ claims: [] })

    // Fetch all claims for matched member IDs; avoid Supabase's default row cap.
    const claims: Record<string, unknown>[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase.schema(SCHEMA).from('mcs_claims')
        .select('id,member_id,claim_no,client_name,claim_status,claim_type,incident_date,incident_country,description')
        .in('member_id', ids).order('id').range(offset, offset + PAGE_SIZE - 1)
      if (error) throw new Error(error.message)
      const page = data ?? []
      claims.push(...page)
      if (page.length < PAGE_SIZE) break
      if (offset >= 99500) throw new Error('Too many claims to display. Narrow the search.')
    }

    return NextResponse.json({
      claims: claims.map(claim => {
        const member = memberMap.get(Number(claim.member_id))!
        return {
          ...claim,
          member_name: member.client_name,
          date_of_birth: member.date_of_birth,
          gender: member.gender,
        }
      })
    })
  } catch (error) {
    console.error('Claim search failed', error)
    return NextResponse.json({ error: 'Unable to search claims. Please try again.' }, { status: 500 })
  }
}
