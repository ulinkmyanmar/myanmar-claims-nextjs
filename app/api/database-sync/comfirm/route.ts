import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { version, coverageDate, records } = body;

    const supabase = await getSupabaseServerClient();

    let insertedCount = 0;

    if (supabase && Array.isArray(records) && records.length > 0) {
      const rowsToInsert = records.map((row: any, idx: number) => ({
        historical_member_id: row.memberId || `MEM-${Date.now()}-${idx}`,
        client_name: row.clientName || "Imported Record",
        date_of_birth: row.dateOfBirth || null,
        gender: row.gender || null,
        claim_no: row.claimNo || `IMPORT-${Date.now()}-${idx}`,
        claim_status: "Active",
        claim_type: "Historical Import",
        createddatetime: new Date().toISOString(),
        createdbyuser: "Admin Myanmar",
        modifieddatetime: new Date().toISOString(),
        modifiedbyuser: "Admin Myanmar",
      }));

      const { error: insertError } = await supabase
        .schema("MyanmarClaimSystem")
        .from("mcs_claims")
        .upsert(rowsToInsert, { onConflict: "historical_member_id" });

      if (insertError) {
        return NextResponse.json({ error: `Database error: ${insertError.message}` }, { status: 500 });
      }

      insertedCount = rowsToInsert.length;
    }

    return NextResponse.json({
      success: true,
      message: "Sync completed successfully",
      insertedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
