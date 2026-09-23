import { NextRequest, NextResponse } from 'next/server';
import { inTransaction } from '@/lib/db';
import { storyFeed } from '@/lib/stories';
import { failure } from '@/lib/api';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{const {id}=await params;return await inTransaction(async()=>NextResponse.json(await storyFeed(req.nextUrl.searchParams,id),{headers:{'Cache-Control':'no-store'}}));}
  catch(error){return failure(error);}
}
