import { withAdmin } from '@/lib/admin';
import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { isScriptureSlug } from '@/lib/scriptures';
import { importScripture } from '@/lib/scriptureImport';
import { ApiError, failure, uuid } from '@/lib/api';

/** Default page size for the admin verse browser — a full text is far too large to send at once. */
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const VERSE_COLUMNS = `
  id, scripture_id, canto, chapter, verse, chapter_title, sanskrit, iast, translation,
  purport, word_for_word, puranic_story, image_prompt, created_at, updated_at
`;

async function loadScripture(id: string) {
  const { rows } = await query(
    'SELECT id, title, has_cantos, version, declared_verse_count FROM scriptures WHERE id = $1',
    [id],
  );
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/scripture-verses?scripture_id=<slug>&limit=&offset=
//
// A page of verses in reading order, plus the totals the editor needs: how many are stored versus
// how many the catalogue entry declares.
// ─────────────────────────────────────────────────────────────
async function handleGET(req: NextRequest) {
  try {
    const scriptureId = req.nextUrl.searchParams.get('scripture_id')
      ?? req.nextUrl.searchParams.get('scriptureId');
    if (!scriptureId || !isScriptureSlug(scriptureId)) {
      return NextResponse.json({ message: 'A valid scripture_id is required.' }, { status: 400 });
    }

    const scripture = await loadScripture(scriptureId);
    if (!scripture) return NextResponse.json({ message: 'Scripture not found.' }, { status: 404 });

    const limitParam = Number(req.nextUrl.searchParams.get('limit'));
    const offsetParam = Number(req.nextUrl.searchParams.get('offset'));
    const limit = Number.isInteger(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_LIMIT)
      : DEFAULT_LIMIT;
    const offset = Number.isInteger(offsetParam) && offsetParam > 0 ? offsetParam : 0;

    const [verses, totals] = await Promise.all([
      query(
        `SELECT ${VERSE_COLUMNS}
         FROM scripture_verses
         WHERE scripture_id = $1
         ORDER BY COALESCE(canto, 0) ASC, chapter ASC, verse ASC
         LIMIT $2 OFFSET $3`,
        [scriptureId, limit, offset],
      ),
      query(
        `SELECT COUNT(*)::int AS verse_count,
                COUNT(DISTINCT chapter)::int AS chapter_count,
                COUNT(DISTINCT canto)::int AS canto_count
         FROM scripture_verses WHERE scripture_id = $1`,
        [scriptureId],
      ),
    ]);

    return NextResponse.json(
      {
        scripture: {
          id: scripture.id,
          title: scripture.title,
          has_cantos: scripture.has_cantos,
          version: scripture.version,
          declared_verse_count: scripture.declared_verse_count,
        },
        ...totals.rows[0],
        limit,
        offset,
        items: verses.rows,
      },
      { status: 200 },
    );
  } catch (error) {
    void error;
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/admin/scripture-verses — bulk upload one scripture's text
//
// Body: {
//   scripture_id: "nrsimha_tapani",
//   mode: "replace" | "append",         // default "replace"
//   verses: [ … ]  (or content: [ … ], or a bare array under `verses`)
//   declared_verse_count?: number
// }
//
// `replace` swaps the whole text in a single transaction, so a failed upload leaves the previous
// text intact rather than a half-written one. `append` exists because a serverless request body
// is capped near 4.5 MB and a Bhagavatam-scale text does not fit in one — upload it canto by
// canto with `append`, having done a `replace` (or nothing) first.
//
// Any verse mutation bumps scriptures.version, which is what makes an installed copy on a device
// look for an update.
// ─────────────────────────────────────────────────────────────
async function handlePOST(req: NextRequest) {
  try { return NextResponse.json(await importScripture(await req.json())); }
  catch (error) { return failure(error); }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/scripture-verses — edit one verse
//
// Body: { id, scripture_id, …verse fields }. A full replace of that verse, validated through the
// same path as a bulk upload so a single edit cannot introduce a shape the app would skip.
// ─────────────────────────────────────────────────────────────
async function handlePUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = uuid(body.id);
    const row = (await query('SELECT * FROM scripture_verses WHERE id=$1', [id])).rows[0];
    if (!row) throw new ApiError(404, 'Verse not found.');
    if ((body.canto ?? null) !== row.canto || body.chapter !== row.chapter || body.verse !== row.verse) {
      throw new ApiError(409, 'Reference identity is immutable. Use an import preview to add or remove references.');
    }
    const result = await importScripture({ ...body, scripture_id: row.scripture_id, mode: 'merge', verses: [body] });
    return NextResponse.json({ ...row, ...body, version: result.version });
  } catch (error) { return failure(error); }
}

async function handleDELETE(req: NextRequest) {
  try {
    const id = uuid(req.nextUrl.searchParams.get('id'));
    const verse = (await query('SELECT * FROM scripture_verses WHERE id=$1', [id])).rows[0];
    if (!verse) throw new ApiError(404, 'Verse not found.');
    await query('SELECT id FROM scriptures WHERE id=$1 FOR UPDATE', [verse.scripture_id]);
    const dependents = (await query('SELECT id, locale, display_date, publication_state FROM daily_verses WHERE verse_id=$1', [id])).rows;
    const quoteDependents=(await query('SELECT id,locale,display_date,publication_state FROM quotes WHERE verse_id=$1',[id])).rows;
    if (dependents.length || quoteDependents.length || req.nextUrl.searchParams.get('confirm') !== id) {
      throw new ApiError(409, 'Review dependencies and confirm the exact verse id. Bulk deletion is disabled.', { dependents,quoteDependents });
    }
    await query('DELETE FROM scripture_verses WHERE id=$1', [id]);
    const version = (await query('UPDATE scriptures SET version=version+1,updated_at=now() WHERE id=$1 RETURNING version', [verse.scripture_id])).rows[0].version;
    return NextResponse.json({ message: 'Verse deleted.', version });
  } catch (error) { return failure(error); }
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PUT = withAdmin(handlePUT);
export const DELETE = withAdmin(handleDELETE);
