import { NextResponse, NextRequest } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { pool, query } from '@/lib/db';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Helper: upload one file buffer to Cloudinary and return URLs
async function uploadToCloudinary(
  buffer: Buffer,
  mimeType: string
): Promise<{ public_id: string; secure_url: string; thumbnail_url: string }> {
  const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
  const upload = await cloudinary.uploader.upload(dataUri, { folder: 'vraja-realm-book-pages' });
  const thumbnail_url = cloudinary.url(upload.public_id, {
    width: 400, height: 300, crop: 'fill',
  });
  return { public_id: upload.public_id, secure_url: upload.secure_url, thumbnail_url };
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/book-pages?book_id=<uuid> — pages in reading order
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const bookId = req.nextUrl.searchParams.get('book_id');
    if (!bookId) return NextResponse.json({ message: 'book_id is required.' }, { status: 400 });

    const { rows } = await query(
      'SELECT * FROM book_pages WHERE book_id = $1 ORDER BY page_number ASC',
      [bookId]
    );
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (error) {
    console.error('Fetch pages error:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/admin/book-pages — append one or more pages to a book
// FormData fields:
//   book_id       — required UUID
//   image_0, …    — page images, in order
//   title_0, …    — optional title per image (default "Page N")
//   text_0, …     — optional caption text per image
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const bookId = (formData.get('book_id') as string) ?? null;
    if (!bookId) return NextResponse.json({ message: 'book_id is required.' }, { status: 400 });

    const book = await query('SELECT id FROM books WHERE id = $1', [bookId]);
    if (book.rows.length === 0) return NextResponse.json({ message: 'Book not found.' }, { status: 404 });

    // Collect indexed image files and keep their index so titles/text line up
    const indexed = Array.from(formData.entries())
      .map(([key, value]) => {
        const match = key.match(/^image_(\d+)$/);
        return match && value instanceof File
          ? { index: parseInt(match[1], 10), file: value as File }
          : null;
      })
      .filter((entry): entry is { index: number; file: File } => entry !== null)
      .sort((a, b) => a.index - b.index);

    if (indexed.length === 0) {
      return NextResponse.json({ message: 'At least one image is required.' }, { status: 400 });
    }

    // Page numbers continue from the book's current last page
    const maxResult = await query(
      'SELECT COALESCE(MAX(page_number), 0) AS max FROM book_pages WHERE book_id = $1',
      [bookId]
    );
    let nextPage = (maxResult.rows[0] as { max: number }).max + 1;

    const inserted = [];
    for (const { index, file } of indexed) {
      const bytes  = Buffer.from(await file.arrayBuffer());
      const { public_id, secure_url, thumbnail_url } = await uploadToCloudinary(bytes, file.type);

      const title = ((formData.get(`title_${index}`) as string) ?? '').trim() || `Page ${nextPage}`;
      const text  = ((formData.get(`text_${index}`) as string) ?? '').trim() || null;

      const { rows } = await query(
        `INSERT INTO book_pages
           (book_id, page_number, title, body_text, public_id, image_url, thumbnail_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [bookId, nextPage, title, text, public_id, secure_url, thumbnail_url]
      );
      inserted.push(rows[0]);
      nextPage += 1;
    }

    return NextResponse.json(
      { message: `${inserted.length} page(s) added successfully.`, items: inserted },
      { status: 201 }
    );
  } catch (error) {
    console.error('Add pages error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/book-pages — edit one page OR reorder all pages
// Body (edit):    { id, title?, body_text?, is_active? }
// Body (reorder): { reorder: { book_id, ordered_ids: [...] } }
// ─────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    // ── Reorder payload ──
    if (body?.reorder) {
      const { book_id: bookId, ordered_ids: orderedIds } = body.reorder;
      if (!bookId || !Array.isArray(orderedIds) || orderedIds.length === 0) {
        return NextResponse.json(
          { message: 'reorder requires book_id and a non-empty ordered_ids array.' },
          { status: 400 }
        );
      }

      const existing = await query('SELECT id FROM book_pages WHERE book_id = $1', [bookId]);
      const existingIds = new Set(existing.rows.map((row: { id: string }) => row.id));
      const givenIds = new Set(orderedIds as string[]);
      if (existingIds.size !== givenIds.size || [...existingIds].some(id => !givenIds.has(id))) {
        return NextResponse.json(
          { message: 'ordered_ids must contain every page of this book exactly once.' },
          { status: 400 }
        );
      }

      // Pinned connection: the renumber must run as one transaction to
      // survive the UNIQUE (book_id, page_number) constraint mid-update
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'UPDATE book_pages SET page_number = page_number + 1000000 WHERE book_id = $1',
          [bookId]
        );
        for (let i = 0; i < orderedIds.length; i++) {
          await client.query(
            `UPDATE book_pages
             SET page_number = $1, updated_at = current_timestamp
             WHERE id = $2 AND book_id = $3`,
            [i + 1, orderedIds[i], bookId]
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      const { rows } = await query(
        'SELECT * FROM book_pages WHERE book_id = $1 ORDER BY page_number ASC',
        [bookId]
      );
      return NextResponse.json({ items: rows }, { status: 200 });
    }

    // ── Single-page edit payload ──
    const { id, title, body_text, is_active } = body;
    if (!id) return NextResponse.json({ message: 'ID is required.' }, { status: 400 });

    const { rows } = await query(
      `UPDATE book_pages
       SET title=COALESCE($1,title),
           body_text=COALESCE($2,body_text),
           is_active=COALESCE($3,is_active),
           updated_at=current_timestamp
       WHERE id=$4
       RETURNING *`,
      [
        title     ?? null,
        body_text ?? null,
        is_active !== undefined ? is_active : null,
        id,
      ]
    );

    if (rows.length === 0) return NextResponse.json({ message: 'Not found.' }, { status: 404 });
    return NextResponse.json(rows[0], { status: 200 });
  } catch (error) {
    console.error('Update page error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/book-pages?id=<uuid>
// ─────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'ID is required.' }, { status: 400 });

    const find = await query('SELECT public_id FROM book_pages WHERE id = $1', [id]);
    if (find.rows.length === 0) return NextResponse.json({ message: 'Not found.' }, { status: 404 });

    await cloudinary.uploader.destroy(find.rows[0].public_id).catch(() => null);
    await query('DELETE FROM book_pages WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Deleted successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Delete page error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}
