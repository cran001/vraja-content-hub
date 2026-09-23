import { ApiError,failure,uuid } from '@/lib/api';
import { withAdmin } from '@/lib/admin';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validateDailyVerse, type DailyVerseFields, type DailyVerseInput } from '@/lib/dailyVerses';

const SELECT_COLUMNS = `
  d.id, v.scripture_id, s.title AS scripture_title, v.canto, v.chapter, v.verse,
  d.theme, d.reflection, d.translation_override, d.translation_locale, d.locale, d.revision, d.publication_state,
  to_char(d.display_date, 'YYYY-MM-DD') AS display_date,
  d.priority, d.is_active, d.created_at, d.updated_at
`;

function inputFromJson(body: Record<string, unknown>): DailyVerseInput {
  const pick = (...keys: string[]) => {
    for (const key of keys) if (body[key] !== undefined) return body[key];
    return undefined;
  };
  return {
    scriptureId: pick('scriptureId', 'scripture_id'),
    canto: pick('canto'),
    chapter: pick('chapter'),
    verse: pick('verse'),
    theme: pick('theme'),
    reflection: pick('reflection'),
    translationOverride: pick('translationOverride', 'translation_override'),
    translationLocale: pick('translationLocale', 'translation_locale'),
    locale: pick('locale'),
    displayDate: pick('displayDate', 'display_date'),
    priority: pick('priority'),
    isActive: pick('isActive', 'is_active'),
  };
}

async function resolveVerseId(selection: DailyVerseFields): Promise<string | null> {
  const { rows } = await query(
    `SELECT id FROM scripture_verses
     WHERE scripture_id = $1 AND COALESCE(canto, 0) = $2 AND chapter = $3 AND verse = $4
     LIMIT 1`,
    [selection.scriptureId, selection.canto ?? 0, selection.chapter, selection.verse],
  );
  return rows[0]?.id ?? null;
}

function databaseError(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    return NextResponse.json(
      { message: 'That date already has a daily verse for this locale.' },
      { status: 409 },
    );
  }
  return failure(error);
}

async function handleGET() {
  try {
    const { rows } = await query(
      `SELECT ${SELECT_COLUMNS}
       FROM daily_verses d
       JOIN scripture_verses v ON v.id = d.verse_id
       JOIN scriptures s ON s.id = v.scripture_id
       ORDER BY d.display_date DESC NULLS LAST, d.priority DESC, d.created_at DESC`,
    );
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (error) {
    return databaseError(error);
  }
}

async function handlePOST(req: NextRequest) {
  try {
    const validated = validateDailyVerse(inputFromJson(await req.json()));
    if (!validated.ok) {
      return NextResponse.json({ message: validated.errors[0], errors: validated.errors }, { status: 400 });
    }
    const item = validated.value;
    const verseId = await resolveVerseId(item);
    if (!verseId) {
      return NextResponse.json({ message: 'That scripture verse does not exist.' }, { status: 422 });
    }
    const { rows } = await query(
      `INSERT INTO daily_verses
         (verse_id, theme, reflection, translation_override, locale, display_date,
          priority, is_active, author_id, translation_locale)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        verseId, item.theme, item.reflection, item.translationOverride, item.locale,
        item.displayDate, item.priority, item.isActive, req.headers.get('x-user-id') || null,
        item.translationLocale,
      ],
    );
    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (error) {
    return databaseError(error);
  }
}

async function handlePUT(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return NextResponse.json({ message: 'ID is required.' }, { status: 400 });

    const keys = Object.keys(body).filter(key => key !== 'id');
    if (keys.length === 1 && (keys[0] === 'is_active' || keys[0] === 'isActive')) {
      const active = body[keys[0]] === true || body[keys[0]] === 'true';
      const result = await query(
        'UPDATE daily_verses SET is_active = $1, updated_at = current_timestamp WHERE id = $2 RETURNING id',
        [active, id],
      );
      if (result.rows.length === 0) return NextResponse.json({ message: 'Not found.' }, { status: 404 });
      return NextResponse.json({ id, is_active: active }, { status: 200 });
    }

    const validated = validateDailyVerse(inputFromJson(body));
    if (!validated.ok) {
      return NextResponse.json({ message: validated.errors[0], errors: validated.errors }, { status: 400 });
    }
    const item = validated.value;
    const verseId = await resolveVerseId(item);
    if (!verseId) return NextResponse.json({ message: 'That scripture verse does not exist.' }, { status: 422 });

    const result = await query(
      `UPDATE daily_verses SET
         verse_id = $1, theme = $2, reflection = $3, translation_override = $4,
         locale = $5, display_date = $6, priority = $7, is_active = $8,
         updated_at = current_timestamp, translation_locale = $10
       WHERE id = $9 RETURNING id`,
      [
        verseId, item.theme, item.reflection, item.translationOverride, item.locale,
        item.displayDate, item.priority, item.isActive, id,
        item.translationLocale,
      ],
    );
    if (result.rows.length === 0) return NextResponse.json({ message: 'Not found.' }, { status: 404 });
    return NextResponse.json({ id }, { status: 200 });
  } catch (error) {
    return databaseError(error);
  }
}

async function handleDELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'ID is required.' }, { status: 400 });
    uuid(id);
    const assignments=(await query('SELECT day,requested_locale,revision FROM daily_assignments WHERE selection_id=$1',[id])).rows;
    if(assignments.length||req.nextUrl.searchParams.get('confirm')!==id)throw new ApiError(409,'Archive assigned selections to preserve day history. Confirm the exact id to delete an unassigned selection.',{assignments});
    const result = await query('DELETE FROM daily_verses WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) return NextResponse.json({ message: 'Not found.' }, { status: 404 });
    return NextResponse.json({ message: 'Daily verse deleted.' }, { status: 200 });
  } catch (error) {
    return databaseError(error);
  }
}

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
export const PUT = withAdmin(handlePUT);
export const DELETE = withAdmin(handleDELETE);
