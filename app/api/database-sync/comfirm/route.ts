import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { version, coverageDate, records } = body;

    const supabase = await getSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    let insertedCount = 0;

    // 如果上传解析到了记录，格式化并写入数据库
    if (records && Array.isArray(records) && records.length > 0) {
      const rowsToInsert = records.map((row: any, idx: number) => {
        const memberId = row["Historical Member ID"] || row["Member ID"] || `MEM-${Date.now()}-${idx}`;
        const claimNo = row["Claim No"] || row["Claim Number"] || `IMPORT-${Date.now()}-${idx}`;

        return {
          historical_member_id: memberId,
          client_name: row["Preferred Full Name"] || row["Client Name"] || "Imported Record",
          date_of_birth: row["Date of Birth"] || null,
          gender: row["Gender"] || null,
          claim_no: claimNo,
          claim_status: "Active",
          claim_type: "Historical Import",
          createddatetime: new Date().toISOString(),
          createdbyuser: "Admin Myanmar",
          modifieddatetime: new Date().toISOString(),
          modifiedbyuser: "Admin Myanmar",
        };
      });

      // 执行批量插入/写入数据库表 mcs_claims
      const { error: insertError } = await supabase
        .schema("MyanmarClaimSystem")
        .from("mcs_claims")
        .upsert(rowsToInsert, { onConflict: "historical_member_id" });

      if (insertError) {
        console.error("Database Insert Error:", insertError);
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }

      insertedCount = rowsToInsert.length;
    }

    // 保存同步历史审计日志到 mcs_database_sync_history
    await supabase
      .schema("MyanmarClaimSystem")
      .from("mcs_database_sync_history")
      .insert({
        version: version || "New Snapshot",
        coverage_date: coverageDate || new Date().toISOString().split("T")[0],
        inserted: insertedCount,
        status: "Active",
        method: "Controlled sync / upsert",
        updated_by: "Admin Myanmar",
      });

    return NextResponse.json({
      success: true,
      message: "Sync completed successfully",
      insertedCount,
    });
  } catch (error: any) {
    console.error("Confirm API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
