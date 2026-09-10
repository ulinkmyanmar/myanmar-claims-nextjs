import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { version, coverageDate, records } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let insertedCount = 0;

    if (Array.isArray(records) && records.length > 0) {
      const rowsToInsert = records.map((row: any, idx: number) => {
        const claimNo = row.claimNo || row["Claim No"] || `CLM-${Date.now()}-${idx}`;
        const clientName = row.clientName || row["Preferred Full Name"] || row["Client Name"] || "Unknown";

        return {
          claim_no: claimNo,
          client_name: clientName,
          date_of_birth: row.dateOfBirth || row["Date of Birth"] || null,
          gender: row.gender || row["Gender"] || null,
          claim_status: "Active",
          claim_type: "Historical Import",
          createddatetime: new Date().toISOString(),
          createdbyuser: "Admin Myanmar",
          modifieddatetime: new Date().toISOString(),
          modifiedbyuser: "Admin Myanmar",
        };
      });

      // 1. 写入主表 mcs_claims
      const { error: insertError } = await supabase
        .schema("MyanmarClaimSystem")
        .from("mcs_claims")
        .insert(rowsToInsert);

      if (insertError) {
        return NextResponse.json({ error: `Database Error: ${insertError.message}` }, { status: 500 });
      }

      insertedCount = rowsToInsert.length;
    }

    // 2. 将同步记录持久化保存到 mcs_database_sync_history 表
    await supabase
      .schema("MyanmarClaimSystem")
      .from("mcs_database_sync_history")
      .insert({
        version: version || "New Snapshot",
        coverage_date: coverageDate || new Date().toISOString().split("T")[0],
        status: "Active",
        method: "Controlled sync / upsert",
        updated_by: "Admin Myanmar",
        createddatetime: new Date().toISOString()
      })
      .catch(() => {}); // 容错忽略

    return NextResponse.json({
      success: true,
      message: "Sync completed successfully",
      insertedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
