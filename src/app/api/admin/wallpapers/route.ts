import { uploadMedia } from '@/lib/mediaUpload';
import { validateMediaPatch } from '@/lib/media';
import { ApiError, failure, uuid,pageNumber } from '@/lib/api';
import { withAdmin } from '@/lib/admin';
import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/db';

// ─────────────────────────────────────────────────────────────
// POST /api/admin/wallpapers — single OR bulk upload
// FormData fields:
//   image_0, image_1, …   — one or more image files
//   name                  — shared name prefix (auto-numbered if bulk)
//   title                 — optional shared title
//   content_type          — wallpaper | darshan | event | sponsor
//   category_id           — UUID (optional)
//   visible_date          — YYYY-MM-DD (required for darshan/event)
//   expires_on            — YYYY-MM-DD (optional)
//   is_sponsor            — "true" | "false"
// ─────────────────────────────────────────────────────────────
async function handlePOST(req: NextRequest) {
  try {
    return NextResponse.json(await uploadMedia(await req.formData(), req.headers.get('x-user-id')!, req.headers.get('Idempotency-Key') ?? ''), { status: 201 });
  } catch (error) { return failure(error); }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/wallpapers?id=<uuid>
// ─────────────────────────────────────────────────────────────
async function handleDELETE(req: NextRequest) {
  try {
    const id = uuid(req.nextUrl.searchParams.get('id'));
    const row = (await query('SELECT id,public_id,name,publication_state FROM wallpapers WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if (!row) throw new ApiError(404, 'Not found.');
    if (req.nextUrl.searchParams.get('confirm') !== id) throw new ApiError(409, 'Confirm the exact media id after reviewing it.', { item: row });
    await query("INSERT INTO media_cleanup(public_id,reason) VALUES ($1,'media_deleted') ON CONFLICT DO NOTHING",[row.public_id]);
    await query('DELETE FROM wallpapers WHERE id=$1',[id]);
    return NextResponse.json({ message: 'Media removed; asset cleanup queued.', cleanup_pending: true });
  } catch (error) { return failure(error); }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/wallpapers  — update metadata
// Body: { id, name, title, content_type, category_id,
//         visible_date, expires_on, is_sponsor, is_active }
// ─────────────────────────────────────────────────────────────
async function handlePUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = uuid(body.id);
    const existing = (await query("SELECT *,to_char(visible_date,'YYYY-MM-DD') AS visible_date,to_char(expires_on,'YYYY-MM-DD') AS expires_on FROM wallpapers WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!existing) throw new ApiError(404, 'Not found.');
    const patch = await validateMediaPatch(body, existing);
    const fields = Object.keys(patch);
    if (!fields.length) return NextResponse.json(existing);
    const result = await query(`UPDATE wallpapers SET ${fields.map((field,i) => field+'=$'+(i+1)).join(',')},updated_at=now() WHERE id=$${fields.length+1} RETURNING *`, [...Object.values(patch),id]);
    return NextResponse.json(result.rows[0]);
  } catch (error) { return failure(error); }
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/wallpapers  — paginated list for the dashboard
// Optional params: content_type, page (default 1), limit (default 50)
// ─────────────────────────────────────────────────────────────
async function handleGET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const contentType = searchParams.get('content_type');
    const page = pageNumber(searchParams.get('page'),1);
    const limit = pageNumber(searchParams.get('limit'),50,100);
    const offset = (page - 1) * limit;

    const params: (string | number)[] = [];
    let sql = `
      SELECT w.*, c.name AS category_name, c.level AS category_level
      FROM wallpapers w
      LEFT JOIN categories c ON w.category_id = c.id
      WHERE 1=1
    `;

    if (contentType) {
      params.push(contentType);
      sql += ` AND w.content_type = $${params.length}`;
    }

    sql += ` ORDER BY w.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await query(sql, params);
    return NextResponse.json({ page, limit, items: rows }, { status: 200 });
  } catch (error) {
    return failure(error);
  }
}
export const POST = withAdmin(handlePOST, false, false);
export const DELETE = withAdmin(handleDELETE);
export const PUT = withAdmin(handlePUT);
export const GET = withAdmin(handleGET);
