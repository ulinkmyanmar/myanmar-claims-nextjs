import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";


export async function GET(req: Request){

 const supabase = await getSupabaseServerClient();

 if(!supabase){
   return NextResponse.json(
    {error:"Not configured"},
    {status:500}
   )
 }


 const {searchParams}=new URL(req.url);

 const keyword =
 searchParams.get("q");


 let query =
 supabase
 .schema("MyanmarClaimSystem")
 .from("mcs_claims")
 .select("*");


 if(keyword){

 query=query.or(
 `
 client_name.ilike.%${keyword}%,
 claim_no.ilike.%${keyword}%,
 hospital_name.ilike.%${keyword}%
 `
 );

 }


 const {data,error}=await query;


 if(error){
   return NextResponse.json(
    {error:error.message},
    {status:500}
   )
 }


 return NextResponse.json(data);

}