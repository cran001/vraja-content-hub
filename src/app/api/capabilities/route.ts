import { NextResponse } from 'next/server';
import { capabilities } from '@/lib/readiness';
export async function GET(){
  try{const result=await capabilities();return NextResponse.json(result,{status:result.schemaReady?200:503,headers:{'Cache-Control':'no-store'}});}
  catch{return NextResponse.json({status:'unavailable',schemaReady:false,capabilities:[]},{status:503,headers:{'Cache-Control':'no-store'}});}
}
