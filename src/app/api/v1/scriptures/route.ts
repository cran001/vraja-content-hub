import { NextRequest } from 'next/server';
import { inTransaction, query } from '@/lib/db';
import { gzippedJson } from '@/lib/httpJson';
import { scriptureSnapshot } from '@/lib/scriptureSnapshots';
import { failure } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    return await inTransaction(async () => {
      const rows = (await query("SELECT s.id FROM scriptures s WHERE s.is_active AND s.publication_state='published' AND EXISTS (SELECT 1 FROM scripture_verses v WHERE v.scripture_id=s.id) ORDER BY s.sort_order,s.title,s.id")).rows;
      const items = [];
      for (const row of rows) items.push((await scriptureSnapshot(row.id)).metadata);
      return gzippedJson(items,req,{headers:{'Cache-Control':'no-store','X-Reconciliation':'complete-catalogue-retain-user-state'}});
    });
  } catch (error) { return failure(error); }
}
