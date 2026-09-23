import { query } from './db';
import { ApiError, indiaDate } from './api';
import { isSupportedLocale } from './dailyVerses';
import { addDays, isIsoDate, toDatedEventPayload } from './datedEvents';

export async function datedEventSelection(params: URLSearchParams) {
  const from=params.get('from')??indiaDate();
  const to=params.get('to')??addDays(from,400);
  const locale=params.get('locale')??'en';
  if (!isIsoDate(from)||!isIsoDate(to)||to<from||to>addDays(from,800)) throw new ApiError(400,'Use a real inclusive date range of at most 800 days.');
  if (!isSupportedLocale(locale)) throw new ApiError(400,'Invalid locale.');
  for (const field of ['location','timezone','region','tradition']) if ((params.get(field)?.length??0)>255) throw new ApiError(400,`Invalid ${field}.`);
  const timezone=params.get('timezone');
  if (timezone) { try { new Intl.DateTimeFormat('en',{timeZone:timezone}).format(); } catch {throw new ApiError(400,'Invalid timezone.');} }
  const rows=(await query(`SELECT * FROM dated_events WHERE is_active AND publication_state='published'
    AND NOT cancelled AND event_date BETWEEN $1::date AND $2::date
    AND (applicability='global' OR (applicability='location' AND scope_key=$3)
      OR (applicability='region' AND scope_key=$4) OR (applicability='tradition' AND scope_key=$5))
    ORDER BY event_date,is_major_event DESC,title,id`,[from,to,params.get('location'),params.get('region'),params.get('tradition')])).rows;
  return rows.map(row=>{
    const timed=Boolean(row.timing_location && row.timing_timezone && row.timing_source
      && row.timing_location===params.get('location') && row.timing_timezone===timezone);
    const hi=locale.split('-')[0]==='hi';
    const translated=hi && Boolean(row.title_hi && row.description_hi);
    const scoped={...row,title:translated?row.title_hi:row.title,description:translated?row.description_hi:row.description,
      fasting_guidelines:translated?row.fasting_guidelines_hi??null:row.fasting_guidelines,
      ...(timed?{}:{parana_date:null,parana_start_time:null,parana_end_time:null,parana_type:null,time_slot:null})};
    return {...toDatedEventPayload(scoped),locale:translated?'hi':'en',requestedLocale:locale,
      languageFallback:(translated?'hi':'en')!==locale,descriptionHi:row.description_hi,
      applicability:row.applicability,scopeKey:row.scope_key,source:row.source_name,sourceUrl:row.source_url,
      provenance:row.provenance,rightsStatus:row.rights_status,revision:row.revision,
      timing:timed?{timezone:row.timing_timezone,location:row.timing_location,source:row.timing_source}:null,
      timingWithheld:Boolean(row.parana_start_time||row.time_slot)&&!timed};
  });
}
