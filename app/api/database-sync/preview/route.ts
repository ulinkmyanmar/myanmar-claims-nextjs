import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type ClaimFields = {
  claimNo: string;
  clientName: string;
  dateOfBirth: string | null;
  gender: string;
  incidentDate: string | null;
  description: string;
};

type ClaimStatus = "NEW_RECORD" | "EXISTING_UPDATE" | "UNCHANGED" | "DUPLICATE";

type PreviewRecord = ClaimFields & {
  groupKey: string;
  historicalMemberId: string;
  existingMemberId: string | null;
  _memberConflict: string | null;
  _status: ClaimStatus;
  _changedFields: string[];
  _existingValues?: Record<string, unknown> | null;
};

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function dateValue(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T|\s|$)/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = text.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{4})$/);
  if (dmy && MONTHS[dmy[2].toLowerCase()]) {
    return `${dmy[3]}-${MONTHS[dmy[2].toLowerCase()]}-${dmy[1].padStart(2, "0")}`;
  }
  return null; // Unrecognized dates must not silently be treated as a valid different date.
}

function textValue(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function parseHistory(value: unknown): { claimNo: string; incidentDate: string | null; description: string }[] {
  if (!value) return [];
  const result: { claimNo: string; incidentDate: string | null; description: string }[] = [];
  for (const line of String(value).split(/\r?\n/)) {
    const parts = line.trim().replace(/^\d+\.\s*/, "").split("|");
    const fields: Record<string, string> = {};
    for (const part of parts) {
      const pos = part.indexOf(":");
      if (pos >= 0) fields[part.slice(0, pos).trim().toLowerCase()] = part.slice(pos + 1).trim();
    }
    const claimNo = textValue(fields["claim number"]);
    if (claimNo) result.push({
      claimNo,
      incidentDate: dateValue(fields["incurred date"]),
      description: textValue(fields["diagnosis"]),
    });
  }
  return result;
}

function changedFields(uploaded: ClaimFields, existing: Record<string, unknown>): string[] {
  const checks: [string, string, string | null, unknown][] = [
    ["client_name", "text", uploaded.clientName, existing.client_name],
    ["date_of_birth", "date", uploaded.dateOfBirth, existing.date_of_birth],
    ["gender", "text", uploaded.gender, existing.gender],
    ["incident_date", "date", uploaded.incidentDate, existing.incident_date],
    ["description", "text", uploaded.description, existing.description],
  ];
  return checks.filter(([, type, incoming, old]) =>
    type === "date"
      ? incoming !== dateValue(old)
      : textValue(incoming).toLowerCase() !== textValue(old).toLowerCase()
  ).map(([field]) => field);
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheetName = workbook.SheetNames.includes("Member Index") ? "Member Index" : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return NextResponse.json({ error: "No readable worksheet found." }, { status: 400 });
    const memberRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (!memberRows.length) return NextResponse.json({ error: "The worksheet is empty." }, { status: 400 });
    const required = ["All Claim History", "Preferred Full Name", "Normalized Name"];
    const headers = Object.keys(memberRows[0]);
    if (!headers.includes(required[0]) || (!headers.includes(required[1]) && !headers.includes(required[2]))) {
      return NextResponse.json({ error: "Expected a Member Index sheet with All Claim History and a member name column." }, { status: 400 });
    }

    // Read the full existing claims set in pages; Supabase often caps a single response.
    const existing = new Map<string, Record<string, unknown>>();
    const duplicateDbClaims = new Set<string>();
    const pageSize = 500;
    for (let start = 0; ; start += pageSize) {
      const { data, error } = await supabase
        .schema("MyanmarClaimSystem")
        .from("mcs_claims")
        .select("claim_no,client_name,date_of_birth,gender,incident_date,description,member_id")
        .order("id", { ascending: true })
        .range(start, start + pageSize - 1);
      if (error) throw new Error(`Could not read existing claims: ${error.message}`);
      const page = data ?? [];
      for (const row of page) {
        const claimNo = textValue(row.claim_no);
        if (!claimNo) continue;
        if (existing.has(claimNo)) duplicateDbClaims.add(claimNo);
        else existing.set(claimNo, row);
      }
      if (page.length < pageSize) break;
    }

    const parsedRecords: PreviewRecord[] = [];
    for (const [index, member] of memberRows.entries()) {
      const base = {
        groupKey: `excel-row-${index + 1}`,
        historicalMemberId: textValue(member["Historical Member ID"]),
        existingMemberId: null,
        _memberConflict: null,
        clientName: textValue(member["Preferred Full Name"] || member["Normalized Name"]),
        dateOfBirth: dateValue(member["Date of Birth"]),
        gender: textValue(member["Gender"]),
      };
      for (const claim of parseHistory(member["All Claim History"])) {
        parsedRecords.push({ ...base, ...claim, _status: "NEW_RECORD", _changedFields: [] });
      }
    }
    if (!parsedRecords.length) return NextResponse.json({ error: "No claim records were found in All Claim History." }, { status: 400 });

    const uploadedCounts = new Map<string, number>();
    for (const row of parsedRecords) uploadedCounts.set(row.claimNo, (uploadedCounts.get(row.claimNo) ?? 0) + 1);
    for (const row of parsedRecords) {
      if ((uploadedCounts.get(row.claimNo) ?? 0) > 1 || duplicateDbClaims.has(row.claimNo)) {
        row._status = "DUPLICATE";
      } else {
        const old = existing.get(row.claimNo);
        if (old) {
          row._existingValues = {
            client_name: old.client_name ?? null,
            date_of_birth: dateValue(old.date_of_birth),
            gender: old.gender ?? null,
            incident_date: dateValue(old.incident_date),
            description: old.description ?? null,
            member_id: old.member_id ?? null,
          };
          row._changedFields = changedFields(row, old);
          row._status = row._changedFields.length ? "EXISTING_UPDATE" : "UNCHANGED";
        }
      }
    }

    // Resolve only through existing claim-number links, never demographic similarity.
    const groupMembers = new Map<string, Set<string>>();
    for (const row of parsedRecords) {
      const set = groupMembers.get(row.groupKey) ?? new Set<string>();
      const old = existing.get(row.claimNo);
      if (old) {
        if (old.member_id === null || old.member_id === undefined) {
          row._memberConflict = "Existing claim is missing its permanent Member ID.";
        } else set.add(String(old.member_id));
      }
      groupMembers.set(row.groupKey, set);
    }
    const memberGroups = memberRows.map((member, index) => {
      const groupKey = `excel-row-${index + 1}`;
      const linkedIds = [...(groupMembers.get(groupKey) ?? [])];
      const conflict = linkedIds.length > 1
        ? `This Excel group contains claims belonging to different Member IDs: ${linkedIds.join(", ")}`
        : parsedRecords.some(r => r.groupKey === groupKey && r._memberConflict)
          ? "An existing claim has no permanent Member ID." : null;
      for (const row of parsedRecords.filter(r => r.groupKey === groupKey)) {
        row.existingMemberId = linkedIds.length === 1 ? linkedIds[0] : null;
        row._memberConflict = conflict;
      }
      return {
        groupKey,
        historicalMemberId: textValue(member["Historical Member ID"]),
        clientName: textValue(member["Preferred Full Name"] || member["Normalized Name"]),
        dateOfBirth: dateValue(member["Date of Birth"]),
        gender: textValue(member["Gender"]),
        existingMemberId: linkedIds.length === 1 ? linkedIds[0] : null,
        conflict,
        claimCount: parsedRecords.filter(r => r.groupKey === groupKey).length,
      };
    }).filter(g => g.claimCount > 0);

    return NextResponse.json({
      memberGroups,
      memberConflicts: memberGroups.filter(g => g.conflict).length,
      unresolvedMembers: memberGroups.filter(g => !g.conflict && !g.existingMemberId).length,
      success: true,
      totalRows: parsedRecords.length,
      existingRecords: existing.size,
      newRecords: parsedRecords.filter((r) => r._status === "NEW_RECORD").length,
      updatedRecords: parsedRecords.filter((r) => r._status === "EXISTING_UPDATE").length,
      unchangedRecords: parsedRecords.filter((r) => r._status === "UNCHANGED").length,
      duplicates: parsedRecords.filter((r) => r._status === "DUPLICATE").length,
      parsedRecords,
    });
  } catch (error) {
    console.error("Synchronization preview failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to preview the uploaded file." }, { status: 500 });
  }
}
