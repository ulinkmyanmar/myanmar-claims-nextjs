// app/api/database-sync/confirm/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const { version, coverageDate, records } = await req.json();

    if (!records || !Array.isArray(records)) {
      return NextResponse.json({ error: "No records to confirm" }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();

    if (supabase) {
      // 1. 将解析出的新纪录格式化并插入 Supabase 数据库表
      const rowsToInsert = records.map((row: any, idx: number) => ({
        historical_member_id: row["Historical Member ID"] || row["Member ID"] || `MEM-${Date.now()}-${idx}`,
        client_name: row["Preferred Full Name"] || row["Client Name"] || "Unknown",
        date_of_birth: row["Date of Birth"] || null,
        gender: row["Gender"] || null,
        claim_no: row["Claim No"] || `CLM-${Date.now()}-${idx}`,
        claim_status: "Active",
        claim_type: "Uploaded Snapshot",
        createddatetime: new Date().toISOString(),
        createdbyuser: "Admin Myanmar",
      }));

      // 执行批量 Upsert (插入或修改)
      const { error } = await supabase
        .schema("MyanmarClaimSystem")
        .from("mcs_claims")
        .upsert(rowsToInsert, { onConflict: "historical_member_id" });

      if (error) {
        console.error("Supabase Sync Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // 2. 插入同步历史记录
      await supabase
        .schema("MyanmarClaimSystem")
        .from("mcs_database_sync_history")
        .insert({
          version,
          coverage_date: coverageDate,
          inserted: rowsToInsert.length,
          status: "Active",
          method: "Controlled sync / upsert",
          updated_by: "Admin Myanmar",
        });
    }

    return NextResponse.json({
      success: true,
      message: "Data merged successfully into live database.",
    });
  } catch (error: any) {
    console.error("Confirm Sync Error:", error);
    return NextResponse.json({ error: error.message || "Failed to save records" }, { status: 500 });
  }
}
