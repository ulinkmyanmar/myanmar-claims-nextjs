// app/api/database-sync/preview/route.ts
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);

    // 优先读取 'Member Index'，如果没有则读取第一个 Sheet
    const sheetName = workbook.SheetNames.includes("Member Index")
      ? "Member Index"
      : workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return NextResponse.json({ error: "No readable sheet found in Excel" }, { status: 400 });
    }

    // 将 Excel 解析为 JSON 对象数组
    const excelRows = XLSX.utils.sheet_to_json<any>(sheet);

    // 获取当前 Supabase 或 Demo 数据库中的原有数据做比对
    const supabase = await getSupabaseServerClient();
    let existingRecords: any[] = [];

    if (supabase) {
      const { data } = await supabase
        .schema("MyanmarClaimSystem")
        .from("mcs_claims")
        .select("historical_member_id, claim_no");
      existingRecords = data || [];
    }

    let newRecordsCount = 0;
    let existingRecordsCount = existingRecords.length;
    let updatedRecordsCount = 0;
    let unchangedRecordsCount = 0;
    let duplicatesCount = 0;

    const parsedRecords = excelRows.map((row) => {
      const memberId = row["Historical Member ID"] || row["Member ID"] || row["ID"];
      const claimNo = row["Claim No"] || row["Claim Number"];

      const isExist = existingRecords.some(
        (e) => (memberId && e.historical_member_id === memberId) || (claimNo && e.claim_no === claimNo)
      );

      if (isExist) {
        updatedRecordsCount++;
        return { ...row, _status: "EXISTING_UPDATE" };
      } else {
        newRecordsCount++;
        return { ...row, _status: "NEW_RECORD" };
      }
    });

    return NextResponse.json({
      success: true,
      totalRows: excelRows.length,
      existingRecords: existingRecordsCount,
      newRecords: newRecordsCount,
      updatedRecords: updatedRecordsCount,
      unchangedRecords: unchangedRecordsCount,
      duplicates: duplicatesCount,
      parsedRecords: parsedRecords, // 返回给前端供 confirm 步骤合并使用
    });
  } catch (error: any) {
    console.error("Preview Parsing Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process file" }, { status: 500 });
  }
}
