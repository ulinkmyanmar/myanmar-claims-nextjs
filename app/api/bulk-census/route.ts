import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

type CensusRow = {
  name?: string
  nrc?: string
  dob?: string
  gender?: string
}

export async function POST(req: Request) {
  try {
    const supabase =
      await getSupabaseServerClient()

    if (!supabase) {
      return NextResponse.json(
        {
          error:
            "Supabase is not configured.",
        },
        { status: 500 }
      )
    }

    const body = await req.json()

    const rows: CensusRow[] =
      Array.isArray(body?.rows)
        ? body.rows
        : []

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No census records were provided.",
        },
        { status: 400 }
      )
    }

    const results = []

    for (const row of rows) {
      const name =
        String(row.name ?? "").trim()

      const nrc =
        String(row.nrc ?? "").trim()

      const dob =
        String(row.dob ?? "").trim()

      const gender =
        String(row.gender ?? "").trim()


      /*
       * No usable identity information.
       */
      if (!name && !nrc) {
        results.push({
          name,
          nrc,
          dob,
          gender,
          status: "No history",
          claims: [],
        })

        continue
      }


      /*
       * Search mcs_claims.
       *
       * Current database fields:
       *
       * client_name
       * passport_no
       *
       * DOB and Gender are not in mcs_claims,
       * so they are not used for matching.
       */
      let query =
        supabase
          .from("mcs_claims")
          .select("*")


      if (name) {
        query = query.ilike(
          "client_name",
          `%${name}%`
        )
      }


      if (nrc) {
        query = query.eq(
          "passport_no",
          nrc
        )
      }


      const {
        data,
        error,
      } = await query


      if (error) {
        console.error(
          "Bulk census query error:",
          error
        )

        return NextResponse.json(
          {
            error: error.message,
          },
          { status: 500 }
        )
      }


      const claims =
        data ?? []


      results.push({
        name,
        nrc,
        dob,
        gender,

        status:
          claims.length > 0
            ? "Matched"
            : "No history",

        claims,
      })
    }


    return NextResponse.json({
      results,
    })

  } catch (error) {

    console.error(
      "Bulk census error:",
      error
    )

    return NextResponse.json(
      {
        error:
          "Unable to process census records.",
      },
      { status: 500 }
    )
  }
}
