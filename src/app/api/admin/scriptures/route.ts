import { ApiError,failure } from '@/lib/api';
import { withAdmin } from '@/lib/admin';
import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { isScriptureSlug, validateScripture, type ScriptureInput } from '@/lib/scriptures';

const SELECT_COLUMNS = `
  s.id, s.title, s.title_hi, s.description, s.category, s.color_hex, s.version,
  s.ref_prefix, s.has_cantos, s.declared_verse_count, s.sort_order, s.is_active,
  s.created_at, s.updated_at
`;

/**
 * Every catalogue row with both counts attached:
 *   declared_verse_count — what the editor said the source text contains
 *   verse_count          — what is actually stored, and what the app would download
 * The admin UI shows them side by side so a truncated upload is visible at a glance.
 */
const LIST_QUERY = `
  SELECT ${SELECT_COLUMNS},
         COUNT(v.id)::int AS verse_count,
         MAX(v.updated_at) AS verses_updated_at
  FROM scriptures s
  LEFT JOIN scripture_verses v ON v.scripture_id = s.id
  GROUP BY s.id
`;

function inputFromJson(body: Record<string, unknown>): ScriptureInput {
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
  const number = (...keys: string[]) => {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === 'number' || typeof value === 'string') return value;
      if (value === null) return null;
    }
    return null;
  };

  return {
    id:                 text('id'),
    title:              text('title'),
    titleHi:            text('titleHi', 'title_hi'),
    description:        text('description'),
    category:           text('category'),
    colorHex:           text('colorHex', 'color_hex'),
    refPrefix:          text('refPrefix', 'ref_prefix'),
    hasCantos:          flag(['hasCantos', 'has_cantos'], false),
    declaredVerseCount: number('declaredVerseCount', 'declared_verse_count'),
    sortOrder:          number('sortOrder', 'sort_order'),
    isActive:           flag(['isActive', 'is_active'], true),
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/scriptures — catalogue with declared vs actual verse counts
// ─────────────────────────────────────────────────────────────
async function handleGET() {
  try {
    const { rows } = await query(`${LIST_QUERY} ORDER BY s.sort_order ASC, s.title ASC`);
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (error) {
    void error;
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/admin/scriptures — create a catalogue entry (JSON body)
//
// The id is the app-facing slug and is derived from the title when omitted. Verses are uploaded
// separately via /api/admin/scripture-verses, so a new scripture starts at zero verses and stays
// out of the public catalogue until it has content.
// ─────────────────────────────────────────────────────────────
async function handlePOST(req: NextRequest) {
  try {
    const authorId = req.headers.get('x-user-id') ?? null;
    const validated = validateScripture(inputFromJson((await req.json()) as Record<string, unknown>));
    if (!validated.ok) {
      return NextResponse.json(
        { message: validated.errors[0], errors: validated.errors },
        { status: 400 },
      );
    }
    const scripture = validated.value;

    const clash = await query('SELECT id FROM scriptures WHERE id = $1', [scripture.id]);
    if (clash.rows.length > 0) {
      return NextResponse.json(
        { message: `A scripture with the id "${scripture.id}" already exists.` },
        { status: 409 },
      );
    }

    const { rows } = await query(
      `INSERT INTO scriptures
         (id, title, title_hi, description, category, color_hex, ref_prefix, has_cantos,
          declared_verse_count, sort_order, is_active, author_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING ${SELECT_COLUMNS.replace(/\bs\./g, '')}, 0 AS verse_count`,
      [
        scripture.id,
        scripture.title,
        scripture.titleHi,
        scripture.description,
        scripture.category,
        scripture.colorHex,
        scripture.refPrefix,
        scripture.hasCantos,
        scripture.declaredVerseCount,
        scripture.sortOrder,
        scripture.isActive,
        authorId,
      ],
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    void error;
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/scriptures — update a catalogue entry
// Body: { id, …fields }  or  { id, is_active } to flip visibility only
//
// `version` is not editable here: it is bumped automatically whenever the verse set changes, so
// the app's update check tracks content rather than metadata edits.
// ─────────────────────────────────────────────────────────────
async function handlePUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) return NextResponse.json({ message: 'ID is required.' }, { status: 400 });

    const existing = await query('SELECT id, has_cantos FROM scriptures WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ message: 'Not found.' }, { status: 404 });
    }

    // Visibility-only shorthand, used by the show/hide toggle in the catalogue list.
    const keys = Object.keys(body).filter(key => key !== 'id');
    if (keys.length === 1 && (keys[0] === 'is_active' || keys[0] === 'isActive')) {
      const nextActive = body[keys[0]] === true || body[keys[0]] === 'true';
      const toggled = await query(
        `UPDATE scriptures SET is_active = $1, updated_at = current_timestamp
         WHERE id = $2 RETURNING ${SELECT_COLUMNS.replace(/\bs\./g, '')}`,
        [nextActive, id],
      );
      return NextResponse.json(toggled.rows[0], { status: 200 });
    }

    const validated = validateScripture({ ...inputFromJson(body), id }, { requireId: false });
    if (!validated.ok) {
      return NextResponse.json(
        { message: validated.errors[0], errors: validated.errors },
        { status: 400 },
      );
    }
    const scripture = validated.value;

    // Flipping has_cantos on a text that is already uploaded would put the catalogue flag at odds
    // with the stored verses, and the app builds every verse reference from it.
    if (scripture.hasCantos !== existing.rows[0].has_cantos) {
      const counts = await query(
        `SELECT COUNT(*)::int AS total,
                COUNT(canto)::int AS with_canto
         FROM scripture_verses WHERE scripture_id = $1`,
        [id],
      );
      const { total, with_canto: withCanto } = counts.rows[0];
      if (total > 0 && (scripture.hasCantos ? withCanto !== total : withCanto !== 0)) {
        return NextResponse.json(
          {
            message: scripture.hasCantos
              ? 'This scripture already has verses without cantos — re-upload the text before marking it as having cantos.'
              : 'This scripture already has verses with cantos — re-upload the text before clearing the cantos flag.',
          },
          { status: 400 },
        );
      }
    }

    const { rows } = await query(
      `UPDATE scriptures SET
         title = $1, title_hi = $2, description = $3, category = $4, color_hex = $5,
         ref_prefix = $6, has_cantos = $7, declared_verse_count = $8, sort_order = $9,
         is_active = $10, updated_at = current_timestamp
       WHERE id = $11
       RETURNING ${SELECT_COLUMNS.replace(/\bs\./g, '')}`,
      [
        scripture.title,
        scripture.titleHi,
        scripture.description,
        scripture.category,
        scripture.colorHex,
        scripture.refPrefix,
        scripture.hasCantos,
        scripture.declaredVerseCount,
        scripture.sortOrder,
        scripture.isActive,
        id,
      ],
    );

    return NextResponse.json(rows[0], { status: 200 });
  } catch (error) {
    void error;
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/scriptures?id=<slug> — removes the entry and its verses (CASCADE)
// ─────────────────────────────────────────────────────────────
async function handleDELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id || !isScriptureSlug(id)) {
      return NextResponse.json({ message: 'A valid scripture id is required.' }, { status: 400 });
    }

    const find = await query('SELECT id FROM scriptures WHERE id = $1', [id]);
    if (find.rows.length === 0) return NextResponse.json({ message: 'Not found.' }, { status: 404 });

    const dependents=(await query('SELECT d.id,d.display_date,d.locale FROM daily_verses d JOIN scripture_verses v ON v.id=d.verse_id WHERE v.scripture_id=$1',[id])).rows;
    const verses=(await query('SELECT id,canto,chapter,verse FROM scripture_verses WHERE scripture_id=$1',[id])).rows;
    const snapshots=(await query('SELECT version FROM scripture_snapshots WHERE scripture_id=$1',[id])).rows;
    if(dependents.length||verses.length||snapshots.length||req.nextUrl.searchParams.get('confirm')!==id)throw new ApiError(409,'Unpublish or archive this scripture. Only an empty, never-distributed catalogue entry can be deleted.',{dependents,verses,snapshots});
    await query('DELETE FROM scriptures WHERE id = $1', [id]);
    return NextResponse.json({ message: 'Deleted successfully.' }, { status: 200 });
  } catch (error) {
    return failure(error);
  }
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PUT = withAdmin(handlePUT);
export const DELETE = withAdmin(handleDELETE);
