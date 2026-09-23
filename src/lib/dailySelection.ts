import { query } from './db';
import { ApiError, indiaDate } from './api';
import { isSupportedLocale, stableDailyIndex, toDailyVersePayload } from './dailyVerses';
import { isIsoDate } from './datedEvents';

const SELECT = `SELECT d.*,to_char(d.display_date,'YYYY-MM-DD') AS display_date,
  v.scripture_id,s.title AS scripture_title,s.ref_prefix,v.canto,v.chapter,v.verse,v.sanskrit,v.iast,v.translation,
  s.source_name AS scripture_source,s.source_url AS scripture_source_url,s.translator AS scripture_translator,
  s.edition AS scripture_edition,s.rights_status AS scripture_rights,s.provenance AS scripture_provenance,
  v.translation_locale AS source_translation_locale
  FROM daily_verses d JOIN scripture_verses v ON v.id=d.verse_id JOIN scriptures s ON s.id=v.scripture_id
  WHERE d.is_active AND d.publication_state='published' AND s.is_active AND s.publication_state='published'
    AND split_part(d.locale,'-',1)=split_part(CASE WHEN nullif(d.translation_override,'') IS NOT NULL THEN d.translation_locale ELSE v.translation_locale END,'-',1)`;

/** The same selector powers public results and editor previews. Prefer the requested
 * language (scheduled, then pool), its base language, then English. */
export async function selectDaily(day: string, locale: string, options: { persist?: boolean; correctionId?: string; reason?: string } = {}) {
  if (!isIsoDate(day) || !isSupportedLocale(locale) || locale.length>16) throw new ApiError(400,'A real date and valid locale are required.');
  const normalized = Intl.getCanonicalLocales(locale)[0];
  const existing=(await query('SELECT * FROM daily_assignments WHERE day=$1 AND requested_locale=$2',[day,normalized])).rows[0];
  if (existing && !options.correctionId) {
    const eligible=await query(SELECT+' AND d.id=$1',[existing.selection_id]);
    if (eligible.rows.length) return { ...existing.payload, assignmentRevision: existing.revision, frozen: true };
  }
  let row;
  if (options.correctionId) {
    if (!options.reason || options.reason.trim().length<12) throw new ApiError(400,'A reviewed correction requires a reason.');
    row=(await query(SELECT+' AND d.id=$1',[options.correctionId])).rows[0];
    if (!row || (row.display_date && row.display_date!==day) || ![normalized,normalized.split('-')[0],'en'].includes(row.locale)) throw new ApiError(422,'Correction must be published, eligible for the requested date and language, and have an active source.');
  } else {
    for (const language of [...new Set([normalized,normalized.split('-')[0],'en'])]) {
      const rows=(await query(SELECT+` AND d.locale=$2 AND (d.display_date=$1::date OR d.display_date IS NULL)
        ORDER BY (d.display_date IS NOT NULL) DESC,d.priority DESC,d.id`,[day,language])).rows;
      const scheduled=rows.filter(r=>r.display_date!==null);
      const candidates=scheduled.length?scheduled:rows;
      row=candidates[scheduled.length?0:stableDailyIndex(day,candidates.length)];
      if (row) break;
    }
  }
  if (!row) throw new ApiError(404,'No eligible published daily verse. Use the bundled fallback.');
  const revision=(existing?.revision??0)+1;
  const payload={...toDailyVersePayload(row,day), requestedLocale: normalized,
    selectionMode: row.display_date?'scheduled':'pool', languageFallback: row.locale!==normalized,
    translationLocale: row.translation_override?row.translation_locale:row.source_translation_locale,
    source: row.source_name??row.scripture_source,sourceUrl:row.source_url??row.scripture_source_url,
    translator:row.translator??row.scripture_translator,edition:row.edition??row.scripture_edition,
    rightsStatus:row.translation_override?row.rights_status:row.scripture_rights,
    provenance:row.provenance??row.scripture_provenance, contentRevision:row.revision,
    assignmentRevision:revision, frozen:false, timezone:'Asia/Kolkata',
    ...(options.reason?{correctionReason:options.reason}:{})};
  if (options.correctionId || (options.persist && day===indiaDate())) {
    await query(`INSERT INTO daily_assignments(day,requested_locale,selection_id,payload,revision)
      VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT(day,requested_locale) DO UPDATE
      SET selection_id=EXCLUDED.selection_id,payload=EXCLUDED.payload,revision=daily_assignments.revision+1,assigned_at=now()`,
    [day,normalized,row.id,JSON.stringify(payload),revision]);
    payload.frozen=true;
  }
  return payload;
}
