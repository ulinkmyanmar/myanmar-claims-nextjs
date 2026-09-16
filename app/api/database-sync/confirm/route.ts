import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await request.json();
    const { version, coverageDate, records } = body;

    if (!version || !coverageDate) {
      return NextResponse.json(
        { error: "Snapshot version and coverage date are required." },
        { status: 400 }
      );
    }

    // 1. 获取当前精准 ISO 时间戳 (包含日期与时分秒)
    const currentISOTimestamp = new Date().toISOString();

    // 2. 如果存在待同步的记录，批量 Upsert 写入 mcs_claims 理赔表
    if (Array.isArray(records) && records.length > 0) {
      const formattedRecords = records.map((rec: any) => ({
        member_id: rec.memberId || null,
        client_name: rec.clientName || null,
        date_of_birth: rec.dateOfBirth || null,
        gender: rec.gender || null,
        claim_no: rec.claimNo || null,
        updated_at: currentISOTimestamp,
      }));

      // 执行批量更新或插入
      const { error: claimsError } = await supabase
        .schema("MyanmarClaimSystem")
        .from("mcs_claims")
        .upsert(formattedRecords, { onConflict: "claim_no" });

      if (claimsError) {
        console.error("Upsert claims error:", claimsError);
        return NextResponse.json(
          { error: `Failed to update claims: ${claimsError.message}` },
          { status: 500 }
        );
      }
    }

    // 3. 将旧的 Active 状态记录更新为 Archived (归档)
    await supabase
      .schema("MyanmarClaimSystem")
      .from("mcs_database_sync_history")
      .update({ status: "Archived" })
      .eq("status", "Active");

    // 4. 插入最新的同步历史记录（带上当前精准时间戳）
    const { error: historyError } = await supabase
      .schema("MyanmarClaimSystem")
      .from("mcs_database_sync_history")
      .insert({
        version: version.trim(),
        coverage_date: coverageDate,
        status: "Active",
        method: "Controlled sync / upsert",
        updated_by: "Admin Myanmar",
        createddatetime: currentISOTimestamp, // 👈 关键点：写入 ISO 时间戳
      });

    if (historyError) {
      console.error("Insert history error:", historyError);
      return NextResponse.json(
        { error: `Failed to write sync history: ${historyError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Database synchronized successfully.",
      syncedCount: records?.length || 0,
      timestamp: currentISOTimestamp,
    });
  } catch (error: any) {
    console.error("Confirm sync server error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error during confirmation." },
      { status: 500 }
    );
  }
}
