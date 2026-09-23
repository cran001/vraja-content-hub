import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { ApiError, failure, uuid } from '@/lib/api';
import { isSupportedLocale } from '@/lib/dailyVerses';

export const GET = withAdmin(async (req: NextRequest) => {
  const all=req.headers.get('x-user-role')==='super_admin';
  const items=(await query('SELECT * FROM editorial_contributions WHERE ($1 OR author_id=$2) ORDER BY updated_at DESC LIMIT 100',[all,req.headers.get('x-user-id')])).rows;
  return NextResponse.json({items});
},true);
export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const data=await req.json();
    if (!['verse','story','quote','event','media'].includes(data.content_type)) throw new ApiError(400,'Invalid contribution type.');
    if (typeof data.title!=='string' || !data.title.trim() || data.title.length>255 || typeof data.body!=='string' || data.body.length<12 || data.body.length>50000) throw new ApiError(400,'Provide a title and draft body.');
    if (!isSupportedLocale(data.locale)) throw new ApiError(400,'Invalid locale.');
    if (data.source_url!=null && (typeof data.source_url!=='string' || !/^https?:\/\/[^\s]+$/.test(data.source_url) || data.source_url.length>2048)) throw new ApiError(400,'Invalid source URL.');
    const actor=req.headers.get('x-user-id');
    if (data.id) {
      uuid(data.id);
      const rows=(await query(`UPDATE editorial_contributions SET title=$1,body=$2,locale=$3,source_url=$4,updated_at=now()
        WHERE id=$5 AND author_id=$6 AND state='draft' RETURNING *`,[data.title,data.body,data.locale,data.source_url??null,data.id,actor])).rows;
      if (!rows.length) throw new ApiError(403,'Only your own drafts can be edited.');
      return NextResponse.json(rows[0]);
    }
    return NextResponse.json((await query(`INSERT INTO editorial_contributions(author_id,content_type,title,body,locale,source_url)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,[actor,data.content_type,data.title,data.body,data.locale,data.source_url??null])).rows[0],{status:201});
  } catch (error) { return failure(error); }
},true);
export const PUT = withAdmin(async (req: NextRequest) => {
  try {
    const {id}=await req.json(); uuid(id);
    const rows=(await query("UPDATE editorial_contributions SET state='submitted',updated_at=now() WHERE id=$1 AND author_id=$2 AND state='draft' RETURNING *",[id,req.headers.get('x-user-id')])).rows;
    if (!rows.length) throw new ApiError(403,'Only your own draft can be submitted.');
    return NextResponse.json(rows[0]);
  } catch (error) { return failure(error); }
},true);
