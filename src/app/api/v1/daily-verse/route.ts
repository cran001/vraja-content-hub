import { NextRequest, NextResponse } from 'next/server';
import { inTransaction } from '@/lib/db';
import { selectDaily } from '@/lib/dailySelection';
import { failure, requestedDay } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    const day=requestedDay(req.nextUrl.searchParams.get('date'));
    const locale=req.nextUrl.searchParams.get('locale')??'en';
    return await inTransaction(async()=>NextResponse.json(await selectDaily(day,locale,{persist:true}),{
      headers:{'Cache-Control':'no-store','X-Content-Day':day,'X-Content-Timezone':'Asia/Kolkata'},
    }));
  } catch(error){return failure(error);}
}
