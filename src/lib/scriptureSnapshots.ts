import { createHash } from 'node:crypto';
import { query } from './db';
import { ApiError } from './api';
import { toScripturePayload, toVersePayload } from './scriptures';

/** Execute inside a repeatable-read transaction. Version, metadata and body share one snapshot. */
export async function scriptureSnapshot(id: string) {
  const scripture = (await query("SELECT * FROM scriptures WHERE id=$1 AND is_active AND publication_state='published'",[id])).rows[0];
  if (!scripture) throw new ApiError(404,'Scripture is unavailable. Retain personal reading state.');
  const existing = (await query('SELECT * FROM scripture_snapshots WHERE scripture_id=$1 AND version=$2',[id,scripture.version])).rows[0];
  if (existing) return existing;
  const verses = (await query('SELECT * FROM scripture_verses WHERE scripture_id=$1 ORDER BY COALESCE(canto,0),chapter,verse',[id])).rows;
  if (!verses.length) throw new ApiError(404,'Scripture has no published text.');
  const body = verses.map(verse=>({...toVersePayload(verse),translation_locale:verse.translation_locale,
    source:scripture.source_name,source_url:scripture.source_url,translator:scripture.translator,
    edition:scripture.edition,provenance:scripture.provenance,rights_status:scripture.rights_status}));
  // JSONB canonicalizes object-key ordering. Hash the serialization that all future reads use.
  const canonical = (await query('SELECT $1::jsonb AS body',[JSON.stringify(body)])).rows[0].body;
  const hash = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  const metadata = { ...toScripturePayload({...scripture,verse_count:verses.length}),
    source: scripture.source_name, sourceUrl: scripture.source_url, translator: scripture.translator,
    edition: scripture.edition, provenance: scripture.provenance, rightsStatus: scripture.rights_status,
    contentHash: hash, hashAlgorithm: 'sha256-json-utf8',
    downloadUrl: `/api/v1/scriptures/${id}?version=${scripture.version}&hash=${hash}` };
  const result = await query(`INSERT INTO scripture_snapshots(scripture_id,version,hash,body,metadata)
    VALUES ($1,$2,$3,$4::jsonb,$5::jsonb) ON CONFLICT DO NOTHING RETURNING *`,
  [id,scripture.version,hash,JSON.stringify(canonical),JSON.stringify(metadata)]);
  if (!result.rows.length) throw new ApiError(409,'Snapshot created concurrently. Retry the catalogue request.');
  return result.rows[0];
}
