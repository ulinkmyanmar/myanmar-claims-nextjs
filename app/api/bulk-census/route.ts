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

      if (!name && !nrc) {
        results.push({ name, nrc, dob, gender, status: "No history", claims: [] })
        continue
      }

      let claims: any[] = []

      // 优先用 NRC 做精确匹配（等于，不是模糊包含），
      // 避免短数字串刚好出现在别人证件号里造成误命中
      if (nrc) {
        const { data, error } = await supabase
          .schema("MyanmarClaimSystem")
          .from("mcs_claims")
          .select("*")
          .eq("passport_no", nrc)

        if (error) {
          console.error("Bulk census NRC lookup error:", error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        claims = data ?? []
      }

      // NRC 没匹配到时，再退一步用姓名精确匹配（不区分大小写，但不是模糊包含），
      // 并且必须同时核对生日和性别，只要有一项明确冲突就不算真正匹配
      if (claims.length === 0 && name) {
        const { data, error } = await supabase
          .schema("MyanmarClaimSystem")
          .from("mcs_claims")
          .select("*")
          .ilike("client_name", name)

        if (error) {
          console.error("Bulk census name lookup error:", error)
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        claims = (data ?? []).filter((claim: any) => {
          const dobConflict =
            dob && claim.date_of_birth && String(claim.date_of_birth) !== dob
          const genderConflict =
            gender && claim.gender && claim.gender.toLowerCase() !== gender.toLowerCase()
          return !dobConflict && !genderConflict
        })
      }

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
