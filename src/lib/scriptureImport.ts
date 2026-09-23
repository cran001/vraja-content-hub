import { query } from './db';
import { ApiError } from './api';
import { isScriptureSlug, validateVerses, type VerseFields } from './scriptures';

const key = (v: { canto: number | null; chapter: number; verse: number }) => `${v.canto ?? 0}.${v.chapter}.${v.verse}`;
const columns = ['canto','chapter','verse','chapter_title','sanskrit','iast','translation','purport','word_for_word','puranic_story','image_prompt'] as const;
const json = (value: unknown) => value == null ? null : JSON.stringify(value);
const canonical = (value: unknown): string => {
  if(value==null)return 'null';
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
};

/** Requires the surrounding admin transaction. Lock precedes reads; version and text commit together. */
export async function importScripture(body: Record<string, unknown>) {
  const id = body.scripture_id ?? body.scriptureId;
  if (!isScriptureSlug(id)) throw new ApiError(400, 'A valid scripture_id is required.');
  const mode = body.mode ?? 'replace';
  if (!['replace', 'append', 'merge'].includes(String(mode))) throw new ApiError(400, 'Invalid import mode.');
  const found = await query('SELECT * FROM scriptures WHERE id=$1 FOR UPDATE', [id]);
  const scripture = found.rows[0];
  if (!scripture) throw new ApiError(404, 'Scripture not found.');
  if (body.expected_version !== undefined && body.expected_version !== scripture.version) throw new ApiError(409, 'Scripture changed. Reload before importing.');
  const validated = validateVerses(body.verses ?? body.content ?? body.data, { hasCantos: scripture.has_cantos });
  if (!validated.ok) throw new ApiError(400, validated.errors[0], validated.errors);
  if (validated.value.length > 20000) throw new ApiError(400, 'Upload at most 20,000 verses per batch.');
  const declared = body.declared_verse_count ?? body.declaredVerseCount;
  if (declared !== undefined && (typeof declared !== 'number' || !Number.isInteger(declared) || declared < 0)) throw new ApiError(400, 'Invalid declared verse count.');
  const stored = (await query('SELECT * FROM scripture_verses WHERE scripture_id=$1 ORDER BY COALESCE(canto,0),chapter,verse', [id])).rows;
  const incoming = new Set(validated.value.map(key));
  const old = new Map(stored.map(v => [key(v), v]));
  const removed = mode === 'replace' ? stored.filter(v => !incoming.has(key(v))) : [];
  const dependents = removed.length ? (await query(
    `SELECT d.id, d.verse_id, d.locale, d.reflection, d.priority, d.publication_state,
       to_char(d.display_date,'YYYY-MM-DD') AS display_date
     FROM daily_verses d WHERE d.verse_id=ANY($1::uuid[]) ORDER BY d.id`, [removed.map(v => v.id)],
  )).rows : [];
  const report = { removed: removed.map(v => ({ id: v.id, reference: key(v) })), dependents,
    quoteDependents: removed.length ? (await query('SELECT id,verse_id,reference,locale,publication_state FROM quotes WHERE verse_id=ANY($1::uuid[])',[removed.map(v=>v.id)])).rows : [],
    resolutions: ['retain', 'delete_unreferenced'] };
  if (body.preview === true) return { ...report, version: scripture.version, mutation: false };
  if (removed.length && body.removed_resolution !== 'retain') {
    const confirmed = body.confirm_removed_ids;
    if (body.removed_resolution !== 'delete_unreferenced' || dependents.length || report.quoteDependents.length || !Array.isArray(confirmed)
      || confirmed.length !== removed.length || removed.some(v => !confirmed.includes(v.id))) {
      throw new ApiError(409, 'Review removed references. Retain dependent verses or resolve their selections before deletion.', report);
    }
  }
  if (mode === 'append' && validated.value.some(v => old.has(key(v)))) throw new ApiError(409, 'Append contains existing references. Use merge or replace.');
  const changed = validated.value.filter(v => {
    const previous = old.get(key(v));
    return !previous || columns.some(c => canonical(previous[c]) !== canonical(v[c]));
  });
  const deleting = body.removed_resolution === 'delete_unreferenced' ? removed : [];
  const countChanged = declared !== undefined && declared !== scripture.declared_verse_count;
  if (scripture.is_active && (changed.length || deleting.length || countChanged) && body.reviewed_correction !== true) {
    throw new ApiError(409, 'Published text changes require reviewed_correction=true after reviewing the complete import preview.');
  }
  for (const verse of changed) await upsert(id, verse);
  if (deleting.length) await query('DELETE FROM scripture_verses WHERE id=ANY($1::uuid[])', [deleting.map(v => v.id)]);
  const didChange = changed.length > 0 || deleting.length > 0 || countChanged;
  const updated = didChange ? (await query(
    `UPDATE scriptures SET version=version+1, declared_verse_count=COALESCE($2,declared_verse_count),
      updated_at=now() WHERE id=$1 RETURNING version`, [id, declared ?? null],
  )).rows[0] : scripture;
  const total = (await query('SELECT count(*)::int AS count FROM scripture_verses WHERE scripture_id=$1', [id])).rows[0].count;
  return { scripture_id: id, mode, version: updated.version, changed: didChange, updated: changed.length,
    removed: deleting.length, retained: removed.length - deleting.length, verse_count: total,
    message: didChange ? 'Text saved. Stable references and editorial selections were preserved.' : 'Identical content; version unchanged.' };
}

async function upsert(scriptureId: string, verse: VerseFields) {
  await query(
    `INSERT INTO scripture_verses (scripture_id,canto,chapter,verse,chapter_title,sanskrit,iast,translation,
       purport,word_for_word,puranic_story,image_prompt)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12)
     ON CONFLICT (scripture_id,(COALESCE(canto,0)),chapter,verse) DO UPDATE SET
       chapter_title=EXCLUDED.chapter_title,sanskrit=EXCLUDED.sanskrit,iast=EXCLUDED.iast,
       translation=EXCLUDED.translation,purport=EXCLUDED.purport,word_for_word=EXCLUDED.word_for_word,
       puranic_story=EXCLUDED.puranic_story,image_prompt=EXCLUDED.image_prompt,updated_at=now()`,
    [scriptureId, verse.canto, verse.chapter, verse.verse, verse.chapter_title, verse.sanskrit,
      verse.iast, verse.translation, verse.purport, json(verse.word_for_word), json(verse.puranic_story), verse.image_prompt],
  );
}
