// app/api/database-sync/preview/route.ts
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

// 把 "17-Nov-2023" 这种格式转成标准的 "2023-11-17"
function parseDMYDate(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim();
  const match = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (match) {
    const [, day, mon, year] = match;
    const month = MONTHS[mon.toLowerCase()];
    if (month) return `${year}-${month}-${day.padStart(2, "0")}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

// 把 "All Claim History" 这一整段文字拆解成一条一条独立的理赔记录
// 格式示例："1. Claim Number: 2311170001 | Incurred Date: 17-Nov-2023 | Discharge Date: 17-Nov-2023 | Diagnosis: R50.9 - Fever, unspecified"
function parseClaimHistory(historyText: any): Array<{
  claimNo: string;
  incurredDate: string | null;
  diagnosis: string;
}> {
  if (!historyText) return [];

  const lines = String(historyText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const claims: Array<{ claimNo: string; incurredDate: string | null; diagnosis: string }> = [];

  for (const line of lines) {
    const withoutIndex = line.replace(/^\d+\.\s*/, "");
    const parts = withoutIndex.split("|").map((p) => p.trim());
    const fields: Record<string, string> = {};

    for (const part of parts) {
      const sepIndex = part.indexOf(":");
      if (sepIndex === -1) continue;
      const key = part.slice(0, sepIndex).trim().toLowerCase();
      const value = part.slice(sepIndex + 1).trim();
      fields[key] = value;
    }

    if (fields["claim number"]) {
      claims.push({
        claimNo: fields["claim number"],
        incurredDate: parseDMYDate(fields["incurred date"]),
        diagnosis: fields["diagnosis"] || "",
      });
    }
  }

  return claims;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);

    const sheetName = workbook.SheetNames.includes("Member Index")
      ? "Member Index"
      : workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return NextResponse.json({ error: "No readable sheet found in Excel" }, { status: 400 });
    }

    // 这里每一行是一个"会员"，不是一条"理赔"
    const memberRows = XLSX.utils.sheet_to_json<any>(sheet);

    const supabase = await getSupabaseServerClient();
    let existingClaimNos = new Set<string>();

    if (supabase) {
      const { data } = await supabase
        .schema("MyanmarClaimSystem")
        .from("mcs_claims")
        .select("claim_no");
      existingClaimNos = new Set((data || []).map((r: any) => String(r.claim_no)));
    }

    let newRecordsCount = 0;
    let updatedRecordsCount = 0;

    // 把"会员行"拆解成"理赔行"，一个会员可能拆出多条
    const parsedRecords: any[] = [];

    for (const memberRow of memberRows) {
      const memberId = memberRow["Historical Member ID"] || "";
      const clientName = memberRow["Preferred Full Name"] || memberRow["Normalized Name"] || "";
      const dateOfBirth = parseDMYDate(memberRow["Date of Birth"]);
      const gender = memberRow["Gender"] || "";

      const claims = parseClaimHistory(memberRow["All Claim History"]);

      for (const claim of claims) {
        const isExist = existingClaimNos.has(claim.claimNo);

        parsedRecords.push({
          memberId,
          clientName,
          dateOfBirth,
          gender,
          claimNo: claim.claimNo,
          incidentDate: claim.incurredDate,
          description: claim.diagnosis,
          _status: isExist ? "EXISTING_UPDATE" : "NEW_RECORD",
        });

        if (isExist) updatedRecordsCount++;
        else newRecordsCount++;
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: parsedRecords.length,
      existingRecords: existingClaimNos.size,
      newRecords: newRecordsCount,
      updatedRecords: updatedRecordsCount,
      unchangedRecords: 0,
      duplicates: 0,
      parsedRecords,
    });
  } catch (error: any) {
    console.error("Preview Parsing Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process file" }, { status: 500 });
  }
}
