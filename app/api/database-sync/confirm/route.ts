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
    let formattedRecords: any[] = [];

    // 1. 如果存在待同步的记录，先去重再写入 mcs_claims
    if (Array.isArray(records) && records.length > 0) {
      // 步骤 A：根据 claim_no 进行内存去重，防止同批次数据冲突
      const uniqueRecordsMap = new Map();

      records.forEach((rec: any) => {
        const claimNo = String(
          rec.claimNo || rec.claim_no || rec["Claim No"] || rec["Claim Number"] || ""
        ).trim();
        if (claimNo) {
          // 如果有重复的 claim_no，后面的会覆盖前面的，确保批次内唯一
          uniqueRecordsMap.set(claimNo, {
            claim_no: claimNo,
            client_name: rec.clientName || rec.client_name || "",
            date_of_birth: rec.dateOfBirth || rec.date_of_birth || null,
            gender: rec.gender || null,
            createddatetime: currentISOTimestamp,
          });
        }
      });

      formattedRecords = Array.from(uniqueRecordsMap.values());

      // 步骤 B：执行去重后的常规 insert 插入数据
      if (formattedRecords.length > 0) {
        const { error: claimsError } = await supabase
          .schema("MyanmarClaimSystem")
          .from("mcs_claims")
          .insert(formattedRecords);

        if (claimsError) {
          console.error("Insert claims error detail:", claimsError);
          return NextResponse.json(
            { error: `Database error: ${claimsError.message}` },
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

    // 3. 插入最新的同步历史记录（带上当前精准 ISO 时间戳）
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
      submittedCount: records?.length || 0,
      insertedCount: formattedRecords.length,
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
