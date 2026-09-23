import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { ApiError, failure, requestedDay, uuid } from '@/lib/api';
import { selectDaily } from '@/lib/dailySelection';
import { addDays } from '@/lib/datedEvents';

export const GET=withAdmin(async (req: NextRequest)=>{
  try {
    const day=requestedDay(req.nextUrl.searchParams.get('date'));
    const locale=req.nextUrl.searchParams.get('locale')??'en';
    const coverage=req.nextUrl.searchParams.get('coverage')==='true';
    if (!coverage) return NextResponse.json(await selectDaily(day,locale));
    const items=[];
    for (let offset=0;offset<90;offset++) {
      const date=addDays(day,offset);
      try { const result=await selectDaily(date,locale); items.push({date,id:result.id,locale:result.locale,scheduled:result.scheduled,languageFallback:result.languageFallback,gap:!result.scheduled}); }
      catch (error) { if (error instanceof ApiError && error.status===404) items.push({date,gap:true,unavailable:true}); else throw error; }
    }
    return NextResponse.json({items,locale,from:day,to:addDays(day,89)});
  } catch(error){return failure(error);}
});
export const POST=withAdmin(async (req: NextRequest)=>{
  try {
    const {date,locale,id,reason}=await req.json(); uuid(id);
    // Serializes corrections against edits to the selected editorial record.
    await query('SELECT id FROM daily_verses WHERE id=$1 FOR UPDATE',[id]);
    return NextResponse.json(await selectDaily(date,locale,{correctionId:id,reason}));
  } catch(error){return failure(error);}
});
