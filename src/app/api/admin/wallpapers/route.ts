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
): Promise<{ public_id: string; secure_url: string; thumbnail_url: string }> {
  const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
  const upload = await cloudinary.uploader.upload(dataUri, { folder });
  const thumbnail_url = cloudinary.url(upload.public_id, {
    width: 400, height: 300, crop: 'fill',
  });
  return { public_id: upload.public_id, secure_url: upload.secure_url, thumbnail_url };
}

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
export async function POST(req: NextRequest) {
  try {
    const authorId  = req.headers.get('x-user-id') ?? null;
    const formData  = await req.formData();

    const name         = (formData.get('name')         as string) ?? 'Untitled';
    const title        = (formData.get('title')        as string) ?? null;
    const contentType  = (formData.get('content_type') as string) ?? 'wallpaper';
    const categoryId   = (formData.get('category_id')  as string) ?? null;
    const visibleDate  = (formData.get('visible_date') as string) ?? null;
    const expiresOn    = (formData.get('expires_on')   as string) ?? null;
    const isSponsor    = formData.get('is_sponsor') === 'true';

    // Collect all image_* entries (supports bulk)
    const files: File[] = Array.from(formData.entries())
      .filter(([key, value]) => key.startsWith('image') && value instanceof File)
      .map(([, value]) => value as File);

    if (files.length === 0) {
      return NextResponse.json({ message: 'At least one image is required.' }, { status: 400 });
    }

    const folder = isSponsor ? 'vraja-realm-sponsors' : `vraja-realm-${contentType}`;
    const inserted = [];

    for (let i = 0; i < files.length; i++) {
      const file   = files[i];
      const bytes  = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const { public_id, secure_url, thumbnail_url } = await uploadToCloudinary(
        buffer, file.type, folder
      );

      // Auto-number when bulk uploading
      const itemName = files.length > 1 ? `${name} ${i + 1}` : name;

      const { rows } = await query(
        `INSERT INTO wallpapers
           (name, title, content_type, category_id, public_id, original_url,
            thumbnail_url, visible_date, expires_on, is_sponsor, author_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          itemName, title, contentType,
          categoryId  || null,
          public_id, secure_url, thumbnail_url,
          visibleDate || null,
          expiresOn   || null,
          isSponsor, authorId
        ]
      );
      inserted.push(rows[0]);
    }

    return NextResponse.json(
      { message: `${inserted.length} image(s) uploaded successfully.`, items: inserted },
      { status: 201 }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/admin/wallpapers?id=<uuid>
// ─────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ message: 'ID is required.' }, { status: 400 });

    const find = await query('SELECT public_id FROM wallpapers WHERE id = $1', [id]);
    if (find.rows.length === 0) return NextResponse.json({ message: 'Not found.' }, { status: 404 });

    await cloudinary.uploader.destroy(find.rows[0].public_id);
    await query('DELETE FROM wallpapers WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Deleted successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/wallpapers  — update metadata
// Body: { id, name, title, content_type, category_id,
//         visible_date, expires_on, is_sponsor, is_active }
// ─────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const {
      id, name, title, content_type, category_id,
      visible_date, expires_on, is_sponsor, is_active,
    } = await req.json();

    if (!id) return NextResponse.json({ message: 'ID is required.' }, { status: 400 });

    const { rows } = await query(
      `UPDATE wallpapers
       SET name=COALESCE($1,name), title=COALESCE($2,title),
           content_type=COALESCE($3,content_type),
           category_id=$4, visible_date=$5, expires_on=$6,
           is_sponsor=COALESCE($7,is_sponsor),
           is_active=COALESCE($8,is_active),
           updated_at=current_timestamp
       WHERE id=$9
       RETURNING *`,
      [
        name ?? null, title ?? null, content_type ?? null,
        category_id  ?? null, visible_date ?? null, expires_on ?? null,
        is_sponsor !== undefined ? is_sponsor : null,
        is_active  !== undefined ? is_active  : null,
        id
      ]
    );

    if (rows.length === 0) return NextResponse.json({ message: 'Not found.' }, { status: 404 });
    return NextResponse.json(rows[0], { status: 200 });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/admin/wallpapers  — paginated list for the dashboard
// Optional params: content_type, page (default 1), limit (default 50)
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const contentType = searchParams.get('content_type');
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10));
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
    console.error('Fetch error:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}