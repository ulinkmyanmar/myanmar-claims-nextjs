import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

type CensusRow = {
  name?: string
  nrc?: string
  dob?: string
  gender?: string
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\-().]/g, "")
}

export async function POST(req: Request) {
  try {
    const supabase = await getSupabaseServerClient()

    if (!supabase) {
      return NextResponse.json(
        {
          error: "Supabase is not configured.",
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
          error: "No census records were provided.",
        },
        { status: 400 }
      )
    }

    const results = []

    for (const row of rows) {
      const name = String(row.name ?? "").trim()
      const nrc = String(row.nrc ?? "").trim()
      const dob = String(row.dob ?? "").trim()
      const gender = String(row.gender ?? "").trim()

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
       * Get possible records from mcs_claims.
       *
       * Database fields currently available:
       * client_name
       * passport_no
       */
      let query = supabase
        .from("mcs_claims")
        .select("*")

      if (name && nrc) {
        query = query
          .ilike("client_name", `%${name}%`)
          .ilike("passport_no", `%${nrc}%`)
      } else if (name) {
        query = query.ilike(
          "client_name",
          `%${name}%`
        )
      } else {
        query = query.ilike(
          "passport_no",
          `%${nrc}%`
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

      let claims = data ?? []

      /*
       * If both Name and NRC are supplied,
       * perform an additional normalized check.
       *
       * This makes matching tolerant of:
       * John Tan
       * JOHN TAN
       *  E1234567
       * E-1234567
       */
      if (name && nrc) {
        const normalizedName =
          normalize(name)

        const normalizedNrc =
          normalize(nrc)

        claims = claims.filter(
          (claim: any) => {

            const dbName =
              normalize(
                String(
                  claim.client_name ?? ""
                )
              )

            const dbNrc =
              normalize(
                String(
                  claim.passport_no ?? ""
                )
              )

            return (
              dbName.includes(normalizedName) &&
              dbNrc.includes(normalizedNrc)
            )
          }
        )
      }

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
