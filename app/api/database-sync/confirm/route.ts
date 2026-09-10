import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// 1. 增加 GET 方法，方便直接在浏览器访问测试路由是否存在
export async function GET() {
  return NextResponse.json({ message: "Confirm API route is working!" });
}

// 2. 确认同步处理逻辑 (适配 Excel 到 Supabase 的 Mapping)
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
      // Mapping: 将前端 Excel 的字段转化为 Supabase 表 (mcs_claims) 的字段
      const rowsToInsert = records.map((row: any, idx: number) => {
        // 优先获取表格中的 Historical Member ID，若无则生成备用 ID
        const memberId = row.memberId || row["Historical Member ID"] || `HM-${Date.now()}-${idx}`;
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

      // 执行写入操作
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
