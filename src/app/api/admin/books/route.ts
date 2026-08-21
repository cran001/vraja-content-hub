import { NextResponse, NextRequest } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { query } from '@/lib/db';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Helper: upload one file buffer to Cloudinary and return URLs
async function uploadToCloudinary(
  buffer: Buffer,
  mimeType: string,
  folder: string
): Promise<{ public_id: string; secure_url: string }> {
  const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
  const upload = await cloudinary.uploader.upload(dataUri, { folder });
  return { public_id: upload.public_id, secure_url: upload.secure_url };
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/books — list all books with page counts
// ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT b.*,
              (SELECT COUNT(*)::int FROM book_pages p WHERE p.book_id = b.id) AS page_count
       FROM books b
       ORDER BY b.sort_order ASC, b.created_at DESC`
    );
    return NextResponse.json({ items: rows }, { status: 200 });
  } catch (error) {
    console.error('Fetch books error:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/admin/books — create a book
// FormData fields:
//   title        — required
//   description  — optional
//   sort_order   — optional integer (default 0)
//   cover        — optional image file
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authorId = req.headers.get('x-user-id') ?? null;
    const formData = await req.formData();

    const title       = ((formData.get('title') as string) ?? '').trim();
    const description = (formData.get('description') as string) ?? null;
    const sortOrderRaw = formData.get('sort_order') as string | null;
    const sortOrder   = sortOrderRaw !== null && sortOrderRaw !== '' ? parseInt(sortOrderRaw, 10) || 0 : 0;

    if (!title) {
      return NextResponse.json({ message: 'Book title is required.' }, { status: 400 });
    }

    // Cover is optional; accept the file under 'cover' or any image_* key
    const coverEntry = formData.entries().find(
      ([key, value]) => (key === 'cover' || key.startsWith('image')) && value instanceof File
    );
    const coverFile = coverEntry ? (coverEntry[1] as File) : null;

    let coverPublicId: string | null = null;
    let coverUrl: string | null = null;
    if (coverFile && coverFile.size > 0) {
      const bytes  = Buffer.from(await coverFile.arrayBuffer());
      const uploaded = await uploadToCloudinary(bytes, coverFile.type, 'vraja-realm-books');
      coverPublicId = uploaded.public_id;
      coverUrl      = uploaded.secure_url;
    }

    const { rows } = await query(
      `INSERT INTO books (title, description, cover_public_id, cover_url, sort_order, author_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *,
                 (SELECT COUNT(*)::int FROM book_pages p WHERE p.book_id = books.id) AS page_count`,
      [title, description || null, coverPublicId, coverUrl, sortOrder, authorId]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error('Create book error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/books — update book metadata
// Body: { id, title?, description?, sort_order?, is_active? }
// ─────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const { id, title, description, sort_order, is_active } = await req.json();
    if (!id) return NextResponse.json({ message: 'ID is required.' }, { status: 400 });

    const { rows } = await query(
      `UPDATE books
       SET title=COALESCE($1,title),
           description=COALESCE($2,description),
           sort_order=COALESCE($3,sort_order),
           is_active=COALESCE($4,is_active),
           updated_at=current_timestamp
       WHERE id=$5
       RETURNING *,
                 (SELECT COUNT(*)::int FROM book_pages p WHERE p.book_id = books.id) AS page_count`,
      [
        title       ?? null,
        description ?? null,
        sort_order  ?? null,
        is_active !== undefined ? is_active : null,
        id,
      ]
    );

    if (rows.length === 0) return NextResponse.json({ message: 'Not found.' }, { status: 404 });
    return NextResponse.json(rows[0], { status: 200 });
  } catch (error) {
    console.error('Update book error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/books?id=<uuid>
// Removes the book, its pages (cascade) and all Cloudinary assets.
// ─────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'ID is required.' }, { status: 400 });

    const find = await query('SELECT id FROM books WHERE id = $1', [id]);
    if (find.rows.length === 0) return NextResponse.json({ message: 'Not found.' }, { status: 404 });

    // Collect every Cloudinary asset (cover + all page images) before the rows vanish
    const assets = await query(
      `SELECT public_id FROM book_pages WHERE book_id = $1
       UNION ALL
       SELECT cover_public_id FROM books WHERE id = $1 AND cover_public_id IS NOT NULL`,
      [id]
    );

    await Promise.all(
      assets.rows.map((row: { public_id: string }) =>
        cloudinary.uploader.destroy(row.public_id).catch(() => null)
      )
    );

    await query('DELETE FROM books WHERE id = $1', [id]);
    return NextResponse.json({ message: 'Deleted successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Delete book error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}
