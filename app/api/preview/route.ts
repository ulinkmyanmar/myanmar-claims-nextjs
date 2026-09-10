import { NextResponse } from "next/server";
import * as XLSX from "xlsx";


export async function POST(req: Request) {

  const formData = await req.formData();

  const file =
    formData.get("file") as File;


  if (!file) {

    return NextResponse.json(
      {
        error:"No file uploaded"
      },
      {
        status:400
      }
    );

  }


  const buffer =
    await file.arrayBuffer();


  const workbook =
    XLSX.read(buffer);


  const sheet =
    workbook.Sheets[
      workbook.SheetNames[0]
    ];


  const rows =
    XLSX.utils.sheet_to_json(sheet);


  return NextResponse.json({

    file:file.name,

    totalRecords:
      rows.length,

    newRecords:
      rows.length,

    updatedRecords:0,

    unchangedRecords:0,

    duplicates:0,

    previewData:
      rows.slice(0,5)

  });

}
