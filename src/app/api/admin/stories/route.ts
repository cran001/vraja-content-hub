import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { ApiError, failure, uuid } from '@/lib/api';
import { isIsoDate } from '@/lib/datedEvents';
import { DAILY_VERSE_THEMES } from '@/lib/dailyVerses';

export const GET=withAdmin(async()=>NextResponse.json({items:(await query('SELECT * FROM books ORDER BY sort_order,title,id')).rows}));
export const PUT=withAdmin(async(req:NextRequest)=>{
  try {
    const body=await req.json(); const id=uuid(body.id);
    const row=(await query('SELECT * FROM books WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!row) throw new ApiError(404,'Create a book first, then curate its story feed entry.');
    if(body.expected_revision!==row.revision) throw new ApiError(409,'Book changed. Reload before editing.');
    const patch:Record<string,unknown>={};
    for(const [field,value] of Object.entries(body)) {
      if(['id','expected_revision'].includes(field))continue;
      if(['title_hi','summary','summary_hi','story_body','story_body_hi'].includes(field)) {
        if(value!==null && (typeof value!=='string'||value.length>(field.startsWith('story_body')?100000:5000)))throw new ApiError(400,`Invalid ${field}.`);
      } else if(['themes','deities','scripture_references'].includes(field)) {
        if(!Array.isArray(value)||value.length>30||value.some(v=>typeof v!=='string'||v.length>255))throw new ApiError(400,`Invalid ${field}.`);
        if(field==='themes'&&value.some(v=>!DAILY_VERSE_THEMES.includes(v)))throw new ApiError(400,'Use supported devotional themes.');
      } else if(field==='is_story') {if(typeof value!=='boolean')throw new ApiError(400,'is_story must be boolean.');}
      else if(field==='published_on') {if(value!==null&&!isIsoDate(value))throw new ApiError(400,'Invalid publication date.');}
      else throw new ApiError(400,`Unknown story field: ${field}.`);
      patch[field]=value;
    }
    const fields=Object.keys(patch);
    if(!fields.length) return NextResponse.json(row);
    return NextResponse.json((await query(`UPDATE books SET ${fields.map((f,i)=>f+'=$'+(i+1)).join(',')},updated_at=now() WHERE id=$${fields.length+1} RETURNING *`,[...Object.values(patch),id])).rows[0]);
  }catch(error){return failure(error);}
});
