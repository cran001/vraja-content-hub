import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/db';

// ─────────────────────────────────────────────────────────────
// GET /api/v1/books          — list of active books for the Library
// GET /api/v1/books?id=<uuid> — one book with all its active pages
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      const { rows } = await query(
        `SELECT b.id, b.title, b.description, b.cover_url, b.sort_order,
                b.created_at, b.updated_at,
                (SELECT COUNT(*)::int FROM book_pages p
                  WHERE p.book_id = b.id AND p.is_active = true) AS page_count
         FROM books b
         WHERE b.is_active = true
         ORDER BY b.sort_order ASC, b.created_at DESC`
      );
      return NextResponse.json(rows, { status: 200 });
    }

    const bookResult = await query(
      `SELECT b.id, b.title, b.description, b.cover_url, b.sort_order,
              b.created_at, b.updated_at
       FROM books b
       WHERE b.id = $1 AND b.is_active = true`,
      [id]
    );
    if (bookResult.rows.length === 0) {
      return NextResponse.json({ message: 'Book not found.' }, { status: 404 });
    }

    const pagesResult = await query(
      `SELECT id, page_number, title, body_text, image_url, thumbnail_url
       FROM book_pages
       WHERE book_id = $1 AND is_active = true
       ORDER BY page_number ASC`,
      [id]
    );

    return NextResponse.json(
      { ...bookResult.rows[0], pages: pagesResult.rows },
      { status: 200 }
    );
  } catch (error) {
    console.error('Fetch books error:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
