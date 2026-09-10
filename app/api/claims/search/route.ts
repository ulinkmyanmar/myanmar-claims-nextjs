import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") ?? "").trim();
  const nrc = (searchParams.get("nrc") ?? "").trim();
  // dob / gender are accepted for forward-compatibility but mcs_claims has
  // no columns for them yet, so they are not applied as filters. See
  // app/api/bulk-census/route.ts for the same limitation.
  const legacyKeyword = (searchParams.get("q") ?? "").trim();

  if (!name && !nrc && !legacyKeyword) {
    return NextResponse.json({ error: "At least one search field is required." }, { status: 400 });
  }

  let query = supabase
    .schema("MyanmarClaimSystem")
    .from("mcs_claims")
    .select("*");

  if (legacyKeyword) {
    // Single-box search (kept for any existing deep links using ?q=)
    const safe = legacyKeyword.replace(/,/g, "");
    query = query.or(`client_name.ilike.%${safe}%,claim_no.ilike.%${safe}%,passport_no.ilike.%${safe}%`);
  } else {
    // Structured search: each filled field narrows the results (AND).
    if (name) query = query.ilike("client_name", `%${name.replace(/,/g, "")}%`);
    if (nrc) query = query.ilike("passport_no", `%${nrc.replace(/,/g, "")}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ claims: data ?? [] });
}

