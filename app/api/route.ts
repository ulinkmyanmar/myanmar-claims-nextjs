import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'

type CensusRow = {
  name: string
  nrc: string
  dob: string
  gender: string
}

export async function POST(req: Request) {
  try {
    const supabase = await getSupabaseServerClient()

    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase is not configured.' },
        { status: 500 }
      )
    }

    const body = await req.json()

    const rows: CensusRow[] = Array.isArray(body?.rows)
      ? body.rows
      : []

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No census records were provided.' },
        { status: 400 }
      )
    }

    const results = []

    for (const row of rows) {
      const name = String(row.name ?? '').trim()
      const nrc = String(row.nrc ?? '').trim()

      if (!name && !nrc) {
        results.push({
          ...row,
          status: 'No history',
          claims: [],
        })

        continue
      }

      let query = supabase
        .from('mcs_claims')
        .select('*')

      if (name && nrc) {
        query = query
          .ilike('client_name', name)
          .ilike('passport_no', nrc)
      } else if (name) {
        query = query.ilike(
          'client_name',
          `%${name}%`
        )
      } else {
        query = query.ilike(
          'passport_no',
          nrc
        )
      }

      const { data, error } = await query

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }

      results.push({
        ...row,
        status:
          data && data.length > 0
            ? 'Matched'
            : 'No history',
        claims: data ?? [],
      })
    }

    return NextResponse.json({
      results,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Unable to process census file.' },
      { status: 500 }
    )
  }
}