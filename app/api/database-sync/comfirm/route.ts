import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { version, coverageDate, records } = body;

    const supabase = await getSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase client initialization failed" },
        { status: 500 }
      );
    }

    let insertedCount = 0;

    if (Array.isArray(records) && records.length > 0) {
      // 对上传的 Excel 字段与 Supabase 字段进行准确 Mapping
      const rowsToInsert = records.map((row: any, idx: number) => {
        // 生成或提取 claim_no
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

      // 写入 Supabase 的 mcs_claims 表
      const { error: insertError } = await supabase
        .schema("MyanmarClaimSystem")
        .from("mcs_claims")
        .upsert(rowsToInsert, { onConflict: "claim_no" });

      if (insertError) {
        return NextResponse.json(
          { error: `Database Error: ${insertError.message}` },
          { status: 500 }
        );
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
