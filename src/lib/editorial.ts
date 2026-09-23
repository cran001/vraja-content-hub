import { query } from './db';
import { ApiError } from './api';
import { isSupportedLocale } from './dailyVerses';

export const EDITORIAL_TABLES = ['wallpapers','books','dated_events','scriptures','daily_verses','quotes'] as const;
export function editorialTable(value: unknown): string {
  if (!EDITORIAL_TABLES.includes(value as typeof EDITORIAL_TABLES[number])) throw new ApiError(400,'Unknown editorial collection.');
  return String(value);
}
export const provenanceFields = ['source_name','source_url','translator','edition','provenance','rights_status','reviewer_notes'];
export async function validatePublication(table: string, row: Record<string, unknown>) {
  if (!row.reviewer_notes || String(row.reviewer_notes).trim().length < 12) throw new ApiError(422,'Add reviewer notes explaining the source and editorial review.');
  if (row.rights_status === 'unknown' || !row.provenance || !row.source_name) throw new ApiError(422,'Source, provenance and a reviewed rights status are required.');
  if (table==='wallpapers' && (!row.alt_text || !row.description)) throw new ApiError(422,'Description and alt text are required before publishing media.');
  if (table==='scriptures') {
    const count=(await query('SELECT count(*)::int AS count FROM scripture_verses WHERE scripture_id=$1',[row.id])).rows[0].count;
    if (!count) throw new ApiError(422,'Upload scripture text before publishing.');
  }
  if (table==='books' && row.is_story) {
    if (!row.cover_url || !row.story_body || !row.summary || !row.published_on) throw new ApiError(422,'Stories require actual cover artwork, a summary, readable body and publication date.');
    if (!Array.isArray(row.themes) || !row.themes.length || !Array.isArray(row.scripture_references) || !row.scripture_references.length) throw new ApiError(422,'Add devotional themes and exact source references before publishing the story.');
    if ((row.title_hi || row.summary_hi || row.story_body_hi) && !(row.title_hi && row.summary_hi && row.story_body_hi)) throw new ApiError(422,'Complete the Hindi title, summary and body together.');
  }
  if (table==='quotes') {
    if (row.kind!=='original_reflection' && (!row.reference || !row.attribution)) throw new ApiError(422,'Attributed quotations require an exact source reference.');
    if (row.kind==='translated_scripture' && !row.verse_id) throw new ApiError(422,'Translated scripture requires a linked verse.');
    if (row.verse_id) {
      const source=(await query('SELECT s.is_active FROM scripture_verses v JOIN scriptures s ON s.id=v.scripture_id WHERE v.id=$1',[row.verse_id])).rows[0];
      if (!source?.is_active) throw new ApiError(422,'Linked scripture must be published.');
    }
  }
  if (table==='daily_verses') {
    const source=(await query("SELECT v.translation_locale,s.is_active,s.publication_state FROM scripture_verses v JOIN scriptures s ON s.id=v.scripture_id WHERE v.id=$1",[row.verse_id])).rows[0];
    if (!source?.is_active || source.publication_state!=='published') throw new ApiError(422,'Daily selections require a published source verse.');
    const locale=String(row.locale).split('-')[0];
    const translationLocale=String(row.translation_override ? row.translation_locale : source.translation_locale).split('-')[0];
    if (locale!==translationLocale) throw new ApiError(422,'Reflection and translation languages differ. Supply a reviewed translation with its correct language.');
  }
  if (table==='dated_events') {
    if (row.applicability!=='global' && !row.scope_key) throw new ApiError(422,'Scoped events require a region, tradition or location key.');
    if (row.parana_start_time && (!row.timing_timezone || !row.timing_location || !row.timing_source)) throw new ApiError(422,'Parana requires an explicit location, timezone and timing source.');
  }
}
export function validateEditorialMetadata(table: string, patch: Record<string, unknown>) {
  const extra = table==='daily_verses' ? ['translation_locale'] : table==='dated_events'
    ? ['description_hi','fasting_guidelines_hi','applicability','scope_key','timing_timezone','timing_location','timing_source','cancelled'] : [];
  for (const [key,value] of Object.entries(patch)) {
    if (![...provenanceFields,...extra].includes(key)) throw new ApiError(400,`Unsupported metadata field: ${key}.`);
    if (key==='cancelled') { if (typeof value!=='boolean') throw new ApiError(400,'cancelled must be boolean.'); continue; }
    if (value!==null && (typeof value!=='string' || value.length>10000)) throw new ApiError(400,`Invalid ${key}.`);
    if (key==='rights_status' && !['unknown','licensed','public_domain','original'].includes(String(value))) throw new ApiError(400,'Invalid rights status.');
    if (key==='source_url' && value!==null && !/^https?:\/\/[^\s]+$/.test(String(value))) throw new ApiError(400,'Invalid source URL.');
    if (key==='translation_locale' && !isSupportedLocale(value)) throw new ApiError(400,'Invalid translation language.');
    if (key==='applicability' && !['global','tradition','region','location'].includes(String(value))) throw new ApiError(400,'Invalid applicability.');
    if (key==='timing_timezone' && value!==null) {
      try { new Intl.DateTimeFormat('en',{timeZone:String(value)}).format(); }
      catch { throw new ApiError(400,'Invalid IANA timezone.'); }
    }
  }
}
