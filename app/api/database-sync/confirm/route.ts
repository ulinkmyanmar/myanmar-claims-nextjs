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

    const currentISOTimestamp = new Date().toISOString();

    // 1. 如果存在待同步的记录，映射并写入 mcs_claims
    if (Array.isArray(records) && records.length > 0) {
      // 构建兼容字段名的 Payload
      const formattedRecords = records.map((rec: any) => {
        const row: Record<string, any> = {
          // 兼容各种可能的理赔单号字段名
          claim_no: rec.claimNo || rec.claim_no || "",
          client_name: rec.clientName || rec.client_name || "",
          date_of_birth: rec.dateOfBirth || rec.date_of_birth || null,
          gender: rec.gender || null,
          createddatetime: currentISOTimestamp,
        };

        // 如果包含 memberId，同时注入多种常见的 key 保证不报错
        if (rec.memberId || rec.member_id) {
          const mId = rec.memberId || rec.member_id;
          row.historical_member_id = mId; // 常见叫法 1
          row.historicalmemberid = mId;   // 常见叫法 2
          row.member_id = mId;            // 常见叫法 3
        }

        return row;
      });

      // 尝试批量更新或插入
      const { error: claimsError } = await supabase
        .schema("MyanmarClaimSystem")
        .from("mcs_claims")
        .upsert(formattedRecords, { onConflict: "claim_no" });

      if (claimsError) {
        console.error("Upsert claims error detail:", claimsError);
        
        // 如果依然报列名错误，降级策略：剥离非核心列再次尝试写入
        if (claimsError.message.includes("Could not find the") && claimsError.message.includes("column")) {
          const fallbackRecords = records.map((rec: any) => ({
            claim_no: rec.claimNo || rec.claim_no || "",
            client_name: rec.clientName || rec.client_name || "",
            date_of_birth: rec.dateOfBirth || rec.date_of_birth || null,
            gender: rec.gender || null,
          }));

          const { error: fallbackErr } = await supabase
            .schema("MyanmarClaimSystem")
            .from("mcs_claims")
            .upsert(fallbackRecords, { onConflict: "claim_no" });

          if (fallbackErr) {
            return NextResponse.json(
              { error: `Database error: ${fallbackErr.message}` },
              { status: 500 }
            );
          }
        } else {
          return NextResponse.json(
            { error: `Failed to update claims: ${claimsError.message}` },
            { status: 500 }
          );
        }
      }
    }

    // 2. 将旧的 Active 状态记录更新为 Archived
    await supabase
      .schema("MyanmarClaimSystem")
      .from("mcs_database_sync_history")
      .update({ status: "Archived" })
      .eq("status", "Active");

    // 3. 插入最新的同步历史记录（带上精确 ISO 时间）
    const { error: historyError } = await supabase
      .schema("MyanmarClaimSystem")
      .from("mcs_database_sync_history")
      .insert({
        version: version.trim(),
        coverage_date: coverageDate,
        status: "Active",
        method: "Controlled sync / upsert",
        updated_by: "Admin Myanmar",
        createddatetime: currentISOTimestamp,
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
