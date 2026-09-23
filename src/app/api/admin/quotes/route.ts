import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { ApiError, failure, uuid } from '@/lib/api';
import { isIsoDate } from '@/lib/datedEvents';
import { DAILY_VERSE_THEMES, isSupportedLocale } from '@/lib/dailyVerses';

export const GET=withAdmin(async()=>NextResponse.json({items:(await query('SELECT * FROM quotes ORDER BY updated_at DESC,id LIMIT 500')).rows}));
const save=withAdmin(async(req:NextRequest)=>{
  try {
    const body=await req.json();
    const id=body.id?uuid(body.id):null;
    const existing=id?(await query('SELECT * FROM quotes WHERE id=$1 FOR UPDATE',[id])).rows[0]:null;
    if(id&&!existing)throw new ApiError(404,'Quote not found.');
    if(existing&&body.expected_revision!==existing.revision)throw new ApiError(409,'Quote changed. Reload before editing.');
    const row={...existing,...body};
    if(!['exact_quote','translated_scripture','original_reflection'].includes(row.kind))throw new ApiError(400,'Choose an exact quotation, translated scripture or original reflection.');
    if(typeof row.text!=='string'||row.text.trim().length<12||row.text.length>1200)throw new ApiError(400,'Quote text must contain 12–1200 characters.');
    if(!isSupportedLocale(row.locale)||row.locale.length>16)throw new ApiError(400,'Invalid locale.');
    row.locale=Intl.getCanonicalLocales(row.locale)[0];
    if(!DAILY_VERSE_THEMES.includes(row.theme))throw new ApiError(400,'Invalid devotional theme.');
    if(typeof row.attribution!=='string'||!row.attribution.trim()||row.attribution.length>500)throw new ApiError(400,'Attribution is required, including for original reflections.');
    if(row.reference!=null&&(typeof row.reference!=='string'||row.reference.length>1000))throw new ApiError(400,'Invalid reference.');
    if(row.verse_id!=null)uuid(row.verse_id,'verse_id');
    if(row.display_date!=null&&!isIsoDate(row.display_date))throw new ApiError(400,'Invalid display date.');
    if(row.lock_screen_eligible!==undefined&&typeof row.lock_screen_eligible!=='boolean')throw new ApiError(400,'Eligibility must be boolean.');
    const values=[row.kind,row.text.trim(),row.locale,row.attribution,row.reference??null,row.verse_id??null,row.theme,row.display_date??null,row.lock_screen_eligible??true];
    const result=id?await query(`UPDATE quotes SET kind=$1,text=$2,locale=$3,attribution=$4,reference=$5,verse_id=$6,theme=$7,display_date=$8,lock_screen_eligible=$9,updated_at=now() WHERE id=$10 RETURNING *`,[...values,id])
      :await query(`INSERT INTO quotes(kind,text,locale,attribution,reference,verse_id,theme,display_date,lock_screen_eligible,author_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[...values,req.headers.get('x-user-id')]);
    return NextResponse.json(result.rows[0],{status:id?200:201});
  }catch(error){return failure(error);}
});
export const POST=save;
export const PUT=save;
export const DELETE=withAdmin(async(req:NextRequest)=>{
  try {
    const id=uuid(req.nextUrl.searchParams.get('id'));
    if(req.nextUrl.searchParams.get('confirm')!==id)throw new ApiError(409,'Confirm the exact quote id to delete.');
    const result=await query('DELETE FROM quotes WHERE id=$1 RETURNING id',[id]);
    if(!result.rowCount)throw new ApiError(404,'Quote not found.');
    return NextResponse.json({message:'Quote deleted. Personal quote visibility remains controlled by Android.'});
  }catch(error){return failure(error);}
});
