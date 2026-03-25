import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET  /api/admin/categories  — full category tree (flat list with parent_id)
 * POST /api/admin/categories  — create a category
 * DELETE /api/admin/categories?id=<uuid> — delete a leaf category
 */

// --- GET: return all categories as a flat list; client builds the tree ---
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT id, name, slug, parent_id, level, created_at
       FROM categories
       ORDER BY level ASC, name ASC`,
      []
    );
    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}

// --- POST: create a new category ---
export async function POST(req: NextRequest) {
  try {
    const { name, parent_id } = await req.json();

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ message: 'Category name is required.' }, { status: 400 });
    }

    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Determine level based on parent
    let level = 0;
    if (parent_id) {
      const parentResult = await query(
        'SELECT level FROM categories WHERE id = $1',
        [parent_id]
      );
      if (parentResult.rows.length === 0) {
        return NextResponse.json({ message: 'Parent category not found.' }, { status: 404 });
      }
      level = parentResult.rows[0].level + 1;
    }

    const { rows } = await query(
      `INSERT INTO categories (name, slug, parent_id, level)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), slug, parent_id ?? null, level]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error('Failed to create category:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}

// --- DELETE: remove a category (CASCADE deletes children) ---
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ message: 'Category ID is required.' }, { status: 400 });
    }

    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ message: 'Category not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Category deleted successfully.' }, { status: 200 });
  } catch (error) {
    console.error('Failed to delete category:', error);
    return NextResponse.json({ message: 'Internal server error.' }, { status: 500 });
  }
}
