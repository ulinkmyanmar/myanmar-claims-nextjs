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
  const dob = (searchParams.get("dob") ?? "").trim();       // expects YYYY-MM-DD
  const gender = (searchParams.get("gender") ?? "").trim();
  const legacyKeyword = (searchParams.get("q") ?? "").trim();

  if (!name && !nrc && !dob && !gender && !legacyKeyword) {
    return NextResponse.json({ error: "At least one search field is required." }, { status: 400 });
  }

  let query = supabase
    .schema("MyanmarClaimSystem")
    .from("mcs_claims")
    .select("*");

  if (legacyKeyword) {
    const safe = legacyKeyword.replace(/,/g, "");
    query = query.or(`client_name.ilike.%${safe}%,claim_no.ilike.%${safe}%,passport_no.ilike.%${safe}%`);
  } else {
    // Each filled field narrows the results further (AND, not OR).
    if (name) query = query.ilike("client_name", `%${name.replace(/,/g, "")}%`);
    if (nrc) query = query.ilike("nrc", `%${nrc.replace(/,/g, "")}%`);
    if (dob) query = query.eq("date_of_birth", dob);
    if (gender) query = query.eq("gender", gender);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ claims: data ?? [] });
}
