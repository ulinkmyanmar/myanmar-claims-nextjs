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
    const supabase = await getSupabaseServerClient()

    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 })
    }

    const body = await req.json()
    const rows: CensusRow[] = Array.isArray(body?.rows) ? body.rows : []

    if (rows.length === 0) {
      return NextResponse.json({ error: "No census records were provided." }, { status: 400 })
    }

    const results = []

    for (const row of rows) {
      const name = String(row.name ?? "").trim()
      const nrc = String(row.nrc ?? "").trim()
      const dob = String(row.dob ?? "").trim()
      const gender = String(row.gender ?? "").trim()

      // mcs_claims currently only stores client_name and passport_no.
      // dob / gender are shown for reference but cannot be matched yet
      // because the database has no columns for them.
      if (!name && !nrc) {
        results.push({ name, nrc, dob, gender, status: "No history", claims: [] })
        continue
      }

      const safeName = name.replace(/,/g, "")
      const safeNrc = nrc.replace(/,/g, "")

      const orParts: string[] = []
      if (safeName) orParts.push(`client_name.ilike.%${safeName}%`)
      if (safeNrc) orParts.push(`passport_no.ilike.%${safeNrc}%`)

      const { data, error } = await supabase
        .from("mcs_claims")
        .select("*")
        .or(orParts.join(","))

      if (error) {
        console.error("Bulk census query error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const claims = data ?? []

      results.push({
        name,
        nrc,
        dob,
        gender,
        status: claims.length > 0 ? "Matched" : "No history",
        claims,
      })
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Bulk census error:", error)
    return NextResponse.json({ error: "Unable to process census records." }, { status: 500 })
  }
}
