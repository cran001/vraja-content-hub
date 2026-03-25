import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/v1/wallpapers
 * Returns active wallpapers (general or filtered by category_id).
 * Optional query params:
 *   - category_id : UUID of a category
 *   - content_type : wallpaper | darshan | event | sponsor  (default: wallpaper)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const contentType = searchParams.get('content_type') ?? 'wallpaper';
    const categoryId = searchParams.get('category_id');

    const params: (string | boolean)[] = [contentType];
    let sql = `
      SELECT
        w.id, w.title, w.name, w.content_type,
        w.original_url, w.thumbnail_url, w.public_id,
        w.visible_date, w.expires_on, w.is_sponsor, w.is_active,
        w.created_at,
        c.id   AS category_id,
        c.name AS category_name,
        c.level AS category_level,
        p.id   AS parent_category_id,
        p.name AS parent_category_name
      FROM wallpapers w
      LEFT JOIN categories c ON w.category_id = c.id
      LEFT JOIN categories p ON c.parent_id   = p.id
      WHERE w.is_active = true
        AND w.content_type = $1
    `;

    // For time-sensitive content types apply date filters
    if (contentType === 'darshan' || contentType === 'event') {
      sql += `
        AND w.visible_date = CURRENT_DATE
        AND (w.expires_on IS NULL OR w.expires_on > CURRENT_DATE)
      `;
    }

    if (categoryId) {
      params.push(categoryId);
      sql += ` AND w.category_id = $${params.length}`;
    }

    sql += ' ORDER BY w.created_at DESC';

    const { rows } = await query(sql, params);
    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch wallpapers:', error);
    return NextResponse.json(
      { message: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}