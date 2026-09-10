import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getSupabaseServerClient } from "@/lib/supabase-server";


export async function POST(req: Request) {

  try {

    const supabase =
      await getSupabaseServerClient();


    if (!supabase) {

      return NextResponse.json(
        {
          error:
          "Supabase is not configured"
        },
        {
          status:500
        }
      );

    }



    const formData =
      await req.formData();


    const file =
      formData.get("file") as File;


    const version =
      String(
        formData.get("version") ?? ""
      );


    const coverageDate =
      String(
        formData.get("coverageDate") ?? ""
      );



    if (!file) {

      return NextResponse.json(
        {
          error:
          "No file uploaded"
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
      workbook.Sheets["Member Index"];



    if (!sheet) {

      return NextResponse.json(
        {
          error:
          "Member Index sheet not found"
        },
        {
          status:400
        }
      );

    }



    const excelRows =
      XLSX.utils.sheet_to_json<any>(
        sheet
      );



    // Get existing database records

    const {
      data: existingRecords,
      error
    } =
      await supabase
        .schema("MyanmarClaimSystem")
        .from("mcs_claims")
        .select("*");



    if(error){

      return NextResponse.json(
        {
          error:error.message
        },
        {
          status:500
        }
      );

    }



    let inserted = 0;

    let updated = 0;

    let unchanged = 0;



    for(
      const row of excelRows
    ){


      const memberId =
        row["Historical Member ID"];


      if(!memberId){

        continue;

      }



      const existing =
        existingRecords?.filter(
          (item:any)=>
          item.historical_member_id
          === memberId
        ) ?? [];



      const newData = {


        historical_member_id:
          memberId,


        client_name:
          row["Preferred Full Name"]
          ?? "",


        date_of_birth:
          row["Date of Birth"]
          ?? null,


        gender:
          row["Gender"]
          ?? null,


        modifieddatetime:
          new Date()
          .toISOString(),


        modifiedbyuser:
          "Admin Myanmar"

      };



      // NEW RECORD

      if(existing.length===0){


        await supabase
          .schema("MyanmarClaimSystem")
          .from("mcs_claims")
          .insert({

            ...newData,

            claim_no:
              `IMPORT-${Date.now()}-${inserted}`,

            claim_status:
              "Imported",

            claim_type:
              "Historical Import",

            createddatetime:
              new Date()
              .toISOString(),

            createdbyuser:
              "Admin Myanmar"

          });


        inserted++;


        continue;

      }




      // EXISTING RECORD CHECK


      const current =
        existing[0];



      const changed =
        current.client_name
        !== newData.client_name
        ||
        current.date_of_birth
        !== newData.date_of_birth
        ||
        current.gender
        !== newData.gender;



      if(changed){


        await supabase
          .schema("MyanmarClaimSystem")
          .from("mcs_claims")
          .update(newData)
          .eq(
            "historical_member_id",
            memberId
          );


        updated++;


      }
      else{


        unchanged++;


      }



    }



    // Save synchronization history

    await supabase
      .schema("MyanmarClaimSystem")
      .from("mcs_database_sync_history")
      .insert({

        version,

        coverage_date:
          coverageDate,

        inserted,

        updated,

        unchanged,

        status:
          "Active",

        method:
          "Controlled sync / upsert",

        updated_by:
          "Admin Myanmar"

      });



    return NextResponse.json({

      success:true,

      inserted,

      updated,

      unchanged

    });



  }

  catch(error:any){


    console.error(error);


    return NextResponse.json(

      {
        error:error.message
      },

      {
        status:500
      }

    );

  }

}
