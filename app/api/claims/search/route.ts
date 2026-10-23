import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

const SCHEMA = 'MyanmarClaimSystem'
const MAX_MEMBERS = 200
const MEMBER_PAGE_SIZE = 500
const MAX_MEMBER_SCAN = 10000
const CLAIM_PAGE_SIZE = 500

type Member = {
  id: number
  client_name: string
  date_of_birth: string | null
  gender: string | null
}

function tokens(value: string): string[] {
  return value.trim().toLocaleLowerCase('en').split(/\s+/u).filter(Boolean)
}

function withoutSpaces(value: string): string {
  return tokens(value).join('')
}

function tokenSorted(value: string): string {
  return tokens(value).sort().join(' ')
}

function matchesName(storedName: string, searchedName: string): boolean {
  const name = storedName.trim().toLocaleLowerCase('en')
  const searched = searchedName.trim().toLocaleLowerCase('en')
  if (!searched) return true

  // Ordinary full/partial search, including spaces.
  if (name.includes(searched)) return true

  // Allow searching YOONTHADARHTUN for "Yoon Thadar Htun".
  if (withoutSpaces(name).includes(withoutSpaces(searched))) return true

  // Same words, different order. Do not guess word boundaries for an
  // unspaced name, e.g. HTUNTHADARYOON is not token-sorted automatically.
  return tokens(searched).length > 1 && tokenSorted(name) === tokenSorted(searched)
}

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
    const keyword = (params.get('q') ?? '').trim() // Preserve existing ?q= links.

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

    // Find members using the permanent registry. Matching names is only
    // used to FIND members, never to combine their identities.
    const memberMap = new Map<number, Member>()
    let scanned = 0
    for (let offset = 0; ; offset += MEMBER_PAGE_SIZE) {
      let query = supabase.schema(SCHEMA).from('mcs_members')
        .select('id,client_name,date_of_birth,gender')
        .order('id').range(offset, offset + MEMBER_PAGE_SIZE - 1)
      if (dob) query = query.eq('date_of_birth', dob)
      if (gender) query = query.eq('gender', gender)

      const { data, error } = await query
      if (error) throw new Error(error.message)
      const page = (data ?? []) as Member[]
      scanned += page.length
      if (scanned > MAX_MEMBER_SCAN) {
        return NextResponse.json({ error: 'Member database is too large for this search mode. Contact the administrator to enable indexed name search.' }, { status: 400 })
      }

      for (const member of page) {
        if (name && !matchesName(member.client_name, name)) continue
        // Legacy ?q= matches member names OR claim numbers.
        if (keyword && !matchesName(member.client_name, keyword)) continue
        memberMap.set(Number(member.id), member)
        if (memberMap.size > MAX_MEMBERS) {
          return NextResponse.json({ error: 'Too many matching members. Narrow your search using Name or Date of Birth.' }, { status: 400 })
        }
      }
      if (page.length < MEMBER_PAGE_SIZE) break
    }

    if (keyword) {
      const safeKeyword = keyword.replace(/[%_,]/g, '')
      if (safeKeyword) {
        const { data: claimMatches, error: matchError } = await supabase.schema(SCHEMA)
          .from('mcs_claims').select('member_id')
          .ilike('claim_no', `%${safeKeyword}%`).limit(MAX_MEMBERS + 1)
        if (matchError) throw new Error(matchError.message)
        if ((claimMatches?.length ?? 0) > MAX_MEMBERS) {
          return NextResponse.json({ error: 'Too many claim-number matches. Narrow your search.' }, { status: 400 })
        }
        const ids = [...new Set((claimMatches ?? []).map(c => Number(c.member_id)).filter(Boolean))]
          .filter(id => !memberMap.has(id))
        if (ids.length) {
          let query = supabase.schema(SCHEMA).from('mcs_members')
            .select('id,client_name,date_of_birth,gender').in('id', ids)
          if (dob) query = query.eq('date_of_birth', dob)
          if (gender) query = query.eq('gender', gender)
          const { data: extra, error: extraError } = await query
          if (extraError) throw new Error(extraError.message)
          for (const member of (extra ?? []) as Member[]) {
            if (name && !matchesName(member.client_name, name)) continue
            memberMap.set(Number(member.id), member)
          }
        }
      }
    }

    if (memberMap.size > MAX_MEMBERS) {
      return NextResponse.json({ error: 'Too many matching members. Narrow your search.' }, { status: 400 })
    }
    const ids = [...memberMap.keys()]
    if (ids.length === 0) return NextResponse.json({ claims: [] })

    const claims: Record<string, unknown>[] = []
    for (let offset = 0; ; offset += CLAIM_PAGE_SIZE) {
      const { data, error } = await supabase.schema(SCHEMA).from('mcs_claims')
        .select('id,member_id,claim_no,client_name,claim_status,claim_type,incident_date,incident_country,description')
        .in('member_id', ids).order('id').range(offset, offset + CLAIM_PAGE_SIZE - 1)
      if (error) throw new Error(error.message)
      const page = data ?? []
      claims.push(...page)
      if (page.length < CLAIM_PAGE_SIZE) break
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
      }),
    })
  } catch (error) {
    console.error('Claim search failed', error)
    return NextResponse.json({ error: 'Unable to search claims. Please try again.' }, { status: 500 })
  }
}
