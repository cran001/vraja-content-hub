import { query } from './db';
import { ApiError, pageNumber, requestedDay, uuid } from './api';
import { isIsoDate } from './datedEvents';
import { isSupportedLocale } from './dailyVerses';

export const MEDIA_TYPES = ['wallpaper', 'darshan', 'event', 'sponsor'];
const textFields: Record<string, number> = { name: 255, title: 255, description: 5000, deity: 255,
  temple: 255, location: 500, credit: 500, source_name: 500, source_url: 2048, provenance: 5000,
  alt_text: 1000, translator: 500, edition: 500 };
const nullable = new Set([...Object.keys(textFields).filter(k => k !== 'name'), 'category_id', 'visible_date', 'expires_on', 'crop']);
const allowed = new Set([...Object.keys(textFields), 'content_type', 'category_id', 'visible_date', 'expires_on', 'is_sponsor', 'is_active', 'rights_status', 'locale', 'crop', 'lock_screen_eligible']);
export async function validateMediaPatch(input: Record<string, unknown>, previous: Record<string, unknown> = {}) {
  const patch: Record<string, unknown> = {};
  const merged = { ...previous, ...input };

  for (const [field, value] of Object.entries(input)) {
    if (field === 'id') continue;
    if (!allowed.has(field)) throw new ApiError(400, `Unknown media field: ${field}.`);
    if (value === null) {
      if (!nullable.has(field)) throw new ApiError(400, `${field} cannot be null.`);
      patch[field] = null; continue;
    }
    if (field in textFields) {
      if (typeof value !== 'string' || value.length > textFields[field] || (field === 'name' && !value.trim())) throw new ApiError(400, `Invalid ${field}.`);
      if (field === 'source_url' && !/^https?:\/\/[^\s]+$/.test(value)) throw new ApiError(400, 'source_url must be an HTTP(S) URL.');
      patch[field] = value.trim();
    } else if (field === 'is_active' || field === 'is_sponsor') {
      if (typeof value !== 'boolean') throw new ApiError(400, `${field} must be boolean.`);
      patch[field] = value;
    } else if (field === 'lock_screen_eligible') {
      if (typeof value !== 'boolean') throw new ApiError(400, 'lock_screen_eligible must be boolean.');
      // Sponsors can never be lock-screen eligible
      if (value && (merged.is_sponsor || merged.content_type === 'sponsor')) {
        throw new ApiError(400, 'Sponsors cannot be lock-screen eligible.');
      }
      patch[field] = value;
    } else if (field === 'category_id') patch[field] = uuid(value, field);
    else if (field === 'visible_date' || field === 'expires_on') {
      if (!isIsoDate(value)) throw new ApiError(400, `${field} must be a real date.`);
      patch[field] = value;
    } else if (field === 'content_type') {
      if (!MEDIA_TYPES.includes(String(value))) throw new ApiError(400, 'Invalid content_type.');
      patch[field] = value;
    } else if (field === 'rights_status') {
      if (!['unknown','licensed','public_domain','original'].includes(String(value))) throw new ApiError(400, 'Invalid rights_status.');
      patch[field] = value;
    } else if (field === 'locale') {
      if (!isSupportedLocale(value) || value.length > 16) throw new ApiError(400, 'Invalid locale.');
      patch[field] = value;
    } else if (field === 'crop') {
      if (typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'crop must contain x, y, width and height fractions.');
      const crop = value as Record<string, unknown>;
      if (Object.keys(crop).sort().join(',') !== 'height,width,x,y' || Object.values(crop).some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1)
        || Number(crop.width) <= 0 || Number(crop.height) <= 0 || Number(crop.x)+Number(crop.width)>1 || Number(crop.y)+Number(crop.height)>1) throw new ApiError(400, 'Invalid crop bounds.');
      patch[field] = JSON.stringify(crop);
    }
  }
  if (merged.category_id) {
    const category = await query('SELECT id FROM categories WHERE id=$1', [merged.category_id]);
    if (!category.rows.length) throw new ApiError(422, 'Category does not exist.');
  }
  if (['darshan','event'].includes(String(merged.content_type)) && !merged.visible_date) throw new ApiError(400, 'Darshan and event artwork require visible_date.');
  if (merged.visible_date && merged.expires_on && String(merged.expires_on) <= String(merged.visible_date)) throw new ApiError(400, 'expires_on is exclusive and must follow visible_date.');
  if (('is_sponsor' in patch || 'content_type' in patch) && Boolean(merged.is_sponsor) !== (merged.content_type === 'sponsor')) throw new ApiError(400, 'Sponsor flag and sponsor content_type must agree.');
  // Enforce: sponsors never eligible for lock-screen, regardless of flag
  if (Boolean(merged.is_sponsor) && ('lock_screen_eligible' in patch || 'is_sponsor' in patch || 'content_type' in patch)) {
    patch.lock_screen_eligible = false;
  }
  return patch;
}

// Include inactive ancestors in the tree so children never become orphans. Their whole
// subtree is withheld from selection. Empty active categories remain visible with count 0.
export const CATEGORY_TREE = `WITH RECURSIVE tree AS (
  SELECT id, parent_id, is_active AS effective_active, ARRAY[id] AS path FROM categories WHERE parent_id IS NULL
  UNION ALL SELECT c.id,c.parent_id,t.effective_active AND c.is_active,t.path || c.id
    FROM categories c JOIN tree t ON c.parent_id=t.id WHERE NOT c.id=ANY(t.path)
)`;
export const MEDIA_VISIBLE = `w.is_active=true AND w.publication_state='published'
  AND (w.visible_date IS NULL OR w.visible_date <= $1::date)
  AND (w.expires_on IS NULL OR w.expires_on > $1::date)
  AND (w.content_type <> 'darshan' OR w.visible_date=$1::date)
  AND (w.category_id IS NULL OR EXISTS (SELECT 1 FROM tree WHERE tree.id=w.category_id AND tree.effective_active))`;

export async function publicMedia(params: URLSearchParams, fixedType?: string) {
  const type = fixedType ?? params.get('content_type') ?? 'wallpaper';
  if (!MEDIA_TYPES.includes(type)) throw new ApiError(400, 'Invalid content_type.');
  const day = requestedDay(params.get('date'));
  const page = pageNumber(params.get('page'), 1);
  const limit = pageNumber(params.get('limit'), 100, 500);
  const paginated=params.has('page')||params.has('limit');
  const categoryId = params.get('category_id');
  const legacy = params.get('category');
  if (categoryId && legacy) throw new ApiError(400, 'Use either category_id or category.');
  let category: string | null = categoryId ? uuid(categoryId, 'category_id') : null;
  if (legacy !== null) {
    if (!legacy.trim() || legacy.length > 255) throw new ApiError(400, 'Invalid category.');
    const rows = (await query('SELECT id FROM categories WHERE slug=$1 OR name=$1', [legacy])).rows;
    if (rows.length > 1) throw new ApiError(400, 'Ambiguous legacy category. Use category_id.');
    if (!rows.length) return { day, items: [], page, limit, paginated };
    category = rows[0].id;
  }
  const { rows } = await query(`${CATEGORY_TREE}
    SELECT w.*, to_char(w.visible_date,'YYYY-MM-DD') AS visible_date,
      to_char(w.expires_on,'YYYY-MM-DD') AS expires_on,
      c.name AS category_name,c.level AS category_level,p.id AS parent_category_id,p.name AS parent_category_name,
      g.name AS grandparent_category_name
    FROM wallpapers w LEFT JOIN categories c ON c.id=w.category_id
      LEFT JOIN categories p ON p.id=c.parent_id LEFT JOIN categories g ON g.id=p.parent_id
    WHERE ${MEDIA_VISIBLE} AND w.content_type=$2 AND w.is_sponsor=$3
      AND ($4::uuid IS NULL OR w.category_id IN (SELECT id FROM tree WHERE $4::uuid=ANY(path)))
    ORDER BY w.created_at DESC,w.id LIMIT $5 OFFSET $6`, [day, type, type === 'sponsor', category, paginated?limit:null, (page-1)*limit]);
  return { day, page, limit, paginated, items: rows.map(publicMediaRow) };
}
export function publicMediaRow(row: Record<string, unknown>) {
  const { author_id: _author, reviewer_notes: _notes, upload_key: _key, ...safe } = row;
  void _author; void _notes; void _key;
  return { ...safe, schedule_timezone: 'Asia/Kolkata', expiry_boundary: 'exclusive',
    placement_eligibility: row.is_sponsor ? ['sponsor'] : [row.content_type] };
}
