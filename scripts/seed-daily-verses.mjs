import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

// Seed the local development Hub with the same curated pool bundled in Android.
// Existing scripture text and existing editorial selections are never overwritten.
const assets = path.resolve('../vrajarealm-android-app-main/app/src/main/assets');
const curatedPath = process.argv[2] || path.join(assets, 'daily_verse_fallback.json');
const corpusPath = process.argv[3] || path.join(assets, 'scriptures/bhagavad_gita.json');
assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname),
  'This seed command is only for the local development database.');
const curated = JSON.parse(await readFile(curatedPath, 'utf8'));
const corpus = JSON.parse(await readFile(corpusPath, 'utf8'));
const byReference = new Map(corpus.map(verse => [`${verse.chapterNum}.${verse.verseNum}`, verse]));
assert(curated.length >= 30, 'The curated pool must contain at least 30 selections.');
const database = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
await database.connect();
let inserted = 0;
try {
  await database.query('BEGIN');
  await database.query(`INSERT INTO scriptures (id, title, ref_prefix, category, declared_verse_count)
    VALUES ('bhagavad_gita', 'Bhagavad Gita', 'BG', 'Gita', $1) ON CONFLICT (id) DO NOTHING`, [corpus.length]);
  // Keep the downloadable scripture complete, even though only 36 verses enter the daily pool.
  for (const source of corpus) {
    assert(source.chapterNum > 0 && source.verseNum > 0 && source.sanskrit && source.translation);
    await database.query(`INSERT INTO scripture_verses
      (scripture_id, chapter, verse, chapter_title, sanskrit, iast, translation)
      VALUES ('bhagavad_gita',$1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
    [source.chapterNum, source.verseNum, source.chapterTitle, source.sanskrit,
      source.transliteration || '', source.translation]);
  }
  for (const selection of curated) {
    const reference = `${selection.chapter}.${selection.verse}`;
    const source = byReference.get(reference);
    assert(source?.sanskrit && source?.translation, `Missing source ${reference}`);
    assert(selection.reflection?.length >= 12 && selection.theme, `Missing curation ${reference}`);
    const result = await database.query(`INSERT INTO daily_verses (verse_id, theme, reflection, locale)
      SELECT v.id, $3, $4, 'en' FROM scripture_verses v
      WHERE v.scripture_id = 'bhagavad_gita' AND v.canto IS NULL AND v.chapter = $1 AND v.verse = $2
        AND NOT EXISTS (SELECT 1 FROM daily_verses d
          WHERE d.verse_id = v.id AND d.locale = 'en' AND d.display_date IS NULL)`,
    [selection.chapter, selection.verse, selection.theme, selection.reflection]);
    inserted += result.rowCount;
  }
  await database.query('COMMIT');
  console.log(`Seeded ${inserted} daily selections; ${curated.length - inserted} existing selections preserved.`);
} catch (error) {
  await database.query('ROLLBACK');
  throw error;
} finally {
  await database.end();
}
