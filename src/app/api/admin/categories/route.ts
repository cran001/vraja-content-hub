import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { ApiError, failure, uuid } from '@/lib/api';

export const GET = withAdmin(async () => NextResponse.json((await query('SELECT * FROM categories ORDER BY level,sort_order,name,id')).rows), true);
export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const { name, parent_id } = await req.json();
    if (typeof name !== 'string' || !name.trim() || name.length>255) throw new ApiError(400, 'Category name is required, up to 255 characters.');
    let level = 0;
    if (parent_id != null) {
      uuid(parent_id, 'parent_id');
      const parent = (await query('SELECT level FROM categories WHERE id=$1 FOR UPDATE',[parent_id])).rows[0];
      if (!parent) throw new ApiError(422, 'Parent category not found.');
      level = parent.level+1;
    }
    const slug = name.trim().toLowerCase().replace(/\s+/g,'-').replace(/[^\p{L}\p{N}-]/gu,'');
    if (!slug) throw new ApiError(400, 'Name must contain letters or numbers.');
    const conflict = await query('SELECT id FROM categories WHERE parent_id IS NOT DISTINCT FROM $1::uuid AND slug=$2',[parent_id??null,slug]);
    if (conflict.rows.length) throw new ApiError(409, 'Category already exists under this parent.');
    return NextResponse.json((await query('INSERT INTO categories(name,slug,parent_id,level) VALUES ($1,$2,$3,$4) RETURNING *',[name.trim(),slug,parent_id??null,level])).rows[0],{status:201});
  } catch (error) { return failure(error); }
});
export const PUT = withAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const id = uuid(body.id);
    const fields = Object.keys(body).filter(k=>k!=='id');
    if (!fields.length || fields.some(k=>!['name','is_active','is_selectable','sort_order'].includes(k))) throw new ApiError(400, 'Only name, is_active, is_selectable and sort_order may be updated.');
    for (const field of fields) {
      if (field==='name' && (typeof body[field]!=='string' || !body[field].trim() || body[field].length>255)) throw new ApiError(400,'Invalid name.');
      if (field.startsWith('is_') && typeof body[field]!=='boolean') throw new ApiError(400,'Expected boolean.');
      if (field==='sort_order' && (!Number.isInteger(body[field]) || Math.abs(body[field])>100000)) throw new ApiError(400,'Invalid sort order.');
    }
    const result = await query(`UPDATE categories SET ${fields.map((f,i)=>f+'=$'+(i+1)).join(',')} WHERE id=$${fields.length+1} RETURNING *`,[...fields.map(f=>body[f]),id]);
    if (!result.rows.length) throw new ApiError(404,'Category not found.');
    return NextResponse.json(result.rows[0]);
  } catch (error) { return failure(error); }
});
export const DELETE = withAdmin(async (req: NextRequest) => {
  try {
    const id = uuid(req.nextUrl.searchParams.get('id'));
    const found = await query('SELECT id FROM categories WHERE id=$1 FOR UPDATE',[id]);
    if (!found.rows.length) throw new ApiError(404,'Category not found.');
    const categories = (await query(`WITH RECURSIVE sub AS (SELECT id,name,parent_id FROM categories WHERE id=$1
      UNION ALL SELECT c.id,c.name,c.parent_id FROM categories c JOIN sub ON c.parent_id=sub.id)
      SELECT * FROM sub`,[id])).rows;
    const media = (await query('SELECT id,name,category_id,publication_state FROM wallpapers WHERE category_id=ANY($1::uuid[])',[categories.map(c=>c.id)])).rows;
    if (categories.length>1 || media.length || req.nextUrl.searchParams.get('confirm')!==id) {
      throw new ApiError(409,'Only an empty leaf category can be deleted. Reassign its media and remove children explicitly.',{categories,media});
    }
    await query('DELETE FROM categories WHERE id=$1',[id]);
    return NextResponse.json({message:'Empty leaf category deleted.'});
  } catch (error) { return failure(error); }
});
