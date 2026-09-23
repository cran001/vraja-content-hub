import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { failure, requestedDay } from '@/lib/api';
import { CATEGORY_TREE, MEDIA_VISIBLE } from '@/lib/media';

export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.has('page') || req.nextUrl.searchParams.has('limit')) {
      return NextResponse.json({ message: 'Category trees are complete; pagination is unsupported.' }, { status: 400 });
    }
    const day = requestedDay(req.nextUrl.searchParams.get('date'));
    const { rows } = await query(`${CATEGORY_TREE}
      SELECT c.id,c.name,c.parent_id,t.effective_active AS is_active,c.is_active AS editorial_is_active,c.sort_order,
        (c.is_selectable AND t.effective_active) AS is_selectable,
        (SELECT count(*)::int FROM wallpapers w JOIN tree child ON child.id=w.category_id
          WHERE c.id=ANY(child.path) AND ${MEDIA_VISIBLE} AND w.content_type='wallpaper' AND w.is_sponsor=false) AS active_wallpaper_count
      FROM categories c JOIN tree t ON t.id=c.id ORDER BY c.level,c.sort_order,c.name,c.id`, [day]);
    return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-cache', 'X-Content-Day': day, 'X-Content-Timezone': 'Asia/Kolkata' } });
  } catch (error) { return failure(error); }
}
