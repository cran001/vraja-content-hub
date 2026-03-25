import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/v1/events
 * Returns festival / special-event images that are active TODAY only.
 * images auto-expire the day after their expiresOn date.
 */
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT
         w.id, w.title, w.name, w.original_url, w.thumbnail_url, w.public_id,
         w.visible_date, w.expires_on, w.created_at,
         c.name  AS category_name,
         c.level AS category_level,
         p.name  AS parent_category_name,
         g.name  AS grandparent_category_name
       FROM wallpapers w
       LEFT JOIN categories c ON w.category_id = c.id
       LEFT JOIN categories p ON c.parent_id    = p.id
       LEFT JOIN categories g ON p.parent_id    = g.id
       WHERE w.is_active    = true
         AND w.content_type = 'event'
         AND w.visible_date = CURRENT_DATE
         AND (w.expires_on IS NULL OR w.expires_on > CURRENT_DATE)
       ORDER BY w.created_at DESC`,
      []
    );

    return NextResponse.json(
      { date: new Date().toISOString().split('T')[0], items: rows },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json(
      { message: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
