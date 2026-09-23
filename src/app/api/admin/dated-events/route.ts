import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { inTransaction,query } from '@/lib/db';
import { assetBatch } from '@/lib/mediaUpload';
import { ApiError,failure,uuid } from '@/lib/api';
import { validateDatedEvent,type DatedEventInput } from '@/lib/datedEvents';
import { validateEditorialMetadata,provenanceFields } from '@/lib/editorial';
const SELECT_COLUMNS = `
  id, title, title_hi, event_type,
  to_char(event_date, 'YYYY-MM-DD') AS event_date,
  description, fasting_guidelines,
  to_char(parana_date, 'YYYY-MM-DD') AS parana_date,
  to_char(parana_start_time, 'HH24:MI') AS parana_start_time,
  to_char(parana_end_time, 'HH24:MI') AS parana_end_time,
  parana_type, time_slot,
  is_major_event, is_active, image_public_id, image_url, details_url,
  created_at, updated_at
`;

/** Reads the event fields out of a FormData body, where every value arrives as a string. */
function inputFromFormData(formData: FormData): DatedEventInput {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : null;
  };
  const flag = (key: string, fallback: boolean) => {
    const value = text(key);
    return value === null ? fallback : value === 'true';
  };

  return {
    title:             text('title'),
    titleHi:           text('title_hi') ?? text('titleHi'),
    eventType:         text('event_type') ?? text('eventType'),
    date:              text('date') ?? text('event_date'),
    description:       text('description'),
    fastingGuidelines: text('fasting_guidelines') ?? text('fastingGuidelines'),
    paranaType:        text('parana_type') ?? text('paranaType'),
    paranaDate:        text('parana_date') ?? text('paranaDate'),
    paranaStartTime:   text('parana_start_time') ?? text('paranaStartTime'),
    paranaEndTime:     text('parana_end_time') ?? text('paranaEndTime'),
    timeSlot:          text('time_slot') ?? text('timeSlot'),
    detailsUrl:        text('details_url') ?? text('detailsUrl'),
    isMajorEvent:      flag('is_major_event', false),
    isActive:          flag('is_active', true),
  };
}

/** Reads the event fields out of a JSON body, accepting camelCase or snake_case keys. */
function inputFromJson(body: Record<string, unknown>): DatedEventInput {
  const text = (...keys: string[]) => {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === 'string') return value;
      if (value === null) return null;
    }
    return null;
  };
  const flag = (keys: string[], fallback: boolean) => {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value === 'true';
    }
    return fallback;
  };

  return {
    title:             text('title'),
    titleHi:           text('titleHi', 'title_hi'),
    eventType:         text('eventType', 'event_type'),
    date:              text('date', 'event_date'),
    description:       text('description'),
    fastingGuidelines: text('fastingGuidelines', 'fasting_guidelines'),
    paranaType:        text('paranaType', 'parana_type'),
    paranaDate:        text('paranaDate', 'parana_date'),
    paranaStartTime:   text('paranaStartTime', 'parana_start_time'),
    paranaEndTime:     text('paranaEndTime', 'parana_end_time'),
    timeSlot:          text('timeSlot', 'time_slot'),
    detailsUrl:        text('detailsUrl', 'details_url'),
    isMajorEvent:      flag(['isMajorEvent', 'is_major_event'], false),
    isActive:          flag(['isActive', 'is_active'], true),
  };
}

/** Picks the event banner out of a FormData body: `image`, or any `image_*` key. */

export const GET=withAdmin(async()=>NextResponse.json({items:(await query(`SELECT ${SELECT_COLUMNS},publication_state,revision,description_hi,fasting_guidelines_hi,applicability,scope_key,timing_timezone,timing_location,timing_source,cancelled FROM dated_events ORDER BY event_date DESC,title,id`)).rows}));
const save=withAdmin(async(req:NextRequest)=>{
  try{
    const multipart=(req.headers.get('content-type')??'').includes('multipart/form-data');
    const form=multipart?await req.formData():null;
    const body:Record<string,unknown>=form?Object.fromEntries(Array.from(form.entries()).filter(([,v])=>!(v instanceof File))):await req.json();
    const id=req.method==='PUT'?uuid(body.id):null;
    const actor=req.headers.get('x-user-id')!;
    const keys=Object.keys(body).filter(k=>k!=='id');
    if(id&&keys.length===1&&['is_active','isActive'].includes(keys[0])) {
      if(typeof body[keys[0]]!=='boolean')throw new ApiError(400,'Visibility must be boolean.');
      return await inTransaction(async()=>{
        const result=await query(`UPDATE dated_events SET is_active=$1,updated_at=now() WHERE id=$2 RETURNING ${SELECT_COLUMNS}`,[body[keys[0]],id]);
        if(!result.rows.length)throw new ApiError(404,'Event not found.');
        return NextResponse.json(result.rows[0]);
      },actor);
    }
    const input=form?inputFromFormData(form):inputFromJson(body);
    for(const [key,value] of Object.entries(input))if(typeof value==='string'&&value.length>10000)throw new ApiError(400,`${key} is too long.`);
    for(const key of ['is_active','isActive','is_major_event','isMajorEvent'])if(body[key]!==undefined&&typeof body[key]!=='boolean'&&(!multipart||!['true','false'].includes(String(body[key]))))throw new ApiError(400,`Invalid ${key}.`);
    const valid=validateDatedEvent(input);if(!valid.ok)throw new ApiError(400,valid.errors[0],valid.errors);
    const e=valid.value;
    const extra:Record<string,unknown>={};
    for(const key of [...provenanceFields,'description_hi','fasting_guidelines_hi','applicability','scope_key','timing_timezone','timing_location','timing_source','cancelled'])if(body[key]!==undefined)extra[key]=body[key]===''?null:key==='cancelled'&&multipart?body[key]==='true':body[key];
    validateEditorialMetadata('dated_events',extra);
    const images=form?Array.from(form.values()).filter(v=>v instanceof File&&v.size>0) as File[]:[];
    if(images.length>1)throw new ApiError(400,'An event has at most one banner.');
    const mutate=async(assets:Awaited<ReturnType<typeof import('@/lib/mediaUpload').assetGateway.upload>>[])=>{
      const previous=id?(await query('SELECT * FROM dated_events WHERE id=$1 FOR UPDATE',[id])).rows[0]:null;
      if(id&&!previous)throw new ApiError(404,'Event not found.');
      const data:Record<string,unknown>={title:e.title,title_hi:e.titleHi,event_type:e.eventType,event_date:e.date,description:e.description,
        fasting_guidelines:e.fastingGuidelines,parana_date:e.paranaDate,parana_start_time:e.paranaStartTime,parana_end_time:e.paranaEndTime,
        parana_type:e.paranaType,time_slot:e.timeSlot,is_major_event:e.isMajorEvent,is_active:e.isActive,details_url:e.detailsUrl,...extra};
      const scope={...previous,...data};
      if(e.paranaStartTime&&(!scope.timing_timezone||!scope.timing_location||!scope.timing_source))throw new ApiError(422,'Provide the timing location, IANA timezone and source; clock times are never universal.');
      if(scope.applicability&&scope.applicability!=='global'&&!scope.scope_key)throw new ApiError(422,'Provide a scope key.');
      const duplicates=(await query(`SELECT id,title,event_date FROM dated_events WHERE lower(title)=lower($1) AND event_date=$2 AND event_type=$3
        AND id::text<>coalesce($4,'') AND applicability=$5 AND scope_key IS NOT DISTINCT FROM $6`,[e.title,e.date,e.eventType,id,scope.applicability??'global',scope.scope_key??null])).rows;
      if(duplicates.length&&body.confirm_duplicate!==true&&body.confirm_duplicate!=='true')throw new ApiError(409,'Possible duplicate event. Review before explicitly confirming a duplicate.',{duplicates});
      const remove=body.remove_image===true||body.remove_image==='true';
      if(assets.length||remove){data.image_public_id=assets[0]?.public_id??null;data.image_url=assets[0]?.original_url??null;}
      if(!id)data.author_id=actor;
      const fields=Object.keys(data);
      const result=id?await query(`UPDATE dated_events SET ${fields.map((f,i)=>f+'=$'+(i+1)).join(',')},updated_at=now() WHERE id=$${fields.length+1} RETURNING ${SELECT_COLUMNS}`,[...Object.values(data),id])
        :await query(`INSERT INTO dated_events(${fields.join(',')}) VALUES (${fields.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING ${SELECT_COLUMNS}`,Object.values(data));
      if(previous?.image_public_id&&(assets.length||remove))await query("INSERT INTO media_cleanup(public_id,reason) VALUES ($1,'event_banner_replaced') ON CONFLICT DO NOTHING",[previous.image_public_id]);
      return result.rows[0];
    };
    const result=images.length?await assetBatch(images,{type:'event',id,body},actor,req.headers.get('Idempotency-Key')??'',mutate):await inTransaction(()=>mutate([]),actor);
    return NextResponse.json(result,{status:id?200:201});
  }catch(error){return failure(error);}
},false,false);
export const POST=save;
export const PUT=save;
export const DELETE=withAdmin(async(req:NextRequest)=>{
  try{
    const id=uuid(req.nextUrl.searchParams.get('id'));
    const row=(await query('SELECT id,title,image_public_id FROM dated_events WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!row)throw new ApiError(404,'Event not found.');
    if(req.nextUrl.searchParams.get('confirm')!==id)throw new ApiError(409,'Confirm the exact event id; use unpublish or cancel to retain editorial history.',row);
    if(row.image_public_id)await query("INSERT INTO media_cleanup(public_id,reason) VALUES ($1,'event_deleted') ON CONFLICT DO NOTHING",[row.image_public_id]);
    await query('DELETE FROM dated_events WHERE id=$1',[id]);
    return NextResponse.json({message:'Event deleted; asset cleanup queued.'});
  }catch(error){return failure(error);}
});
