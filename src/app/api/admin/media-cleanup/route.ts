import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { inTransaction,query } from '@/lib/db';
import { assetGateway } from '@/lib/mediaUpload';
import { ApiError, failure } from '@/lib/api';

export const GET = withAdmin(async () => NextResponse.json({
  cleanup: (await query('SELECT * FROM media_cleanup ORDER BY created_at LIMIT 100')).rows,
  uploads: (await query("SELECT id,state,public_ids,updated_at FROM media_uploads WHERE state<>'complete' ORDER BY updated_at LIMIT 100")).rows,
}));
export const POST = withAdmin(async (req: NextRequest) => {
  try {
    const { public_id,upload_id } = await req.json();
    if(upload_id){
      if(typeof upload_id!=='string')throw new ApiError(400,'Invalid upload_id.');
      return await inTransaction(async()=>{
        const upload=(await query("SELECT * FROM media_uploads WHERE id=$1 AND state IN ('pending','cleanup_required') AND updated_at<now()-interval '15 minutes' FOR UPDATE",[upload_id])).rows[0];
        if(!upload)throw new ApiError(409,'Only unfinished uploads older than 15 minutes can be queued for recovery.');
        for(const id of upload.public_ids)await query("INSERT INTO media_cleanup(public_id,reason) VALUES ($1,'interrupted_upload_recovery') ON CONFLICT DO NOTHING",[id]);
        await query("UPDATE media_uploads SET state='cleanup_required',updated_at=now() WHERE id=$1",[upload_id]);
        return NextResponse.json({message:'Planned assets queued for reference-checked cleanup.',public_ids:upload.public_ids});
      },req.headers.get('x-user-id')!);
    }
    if (typeof public_id !== 'string') throw new ApiError(400, 'public_id required.');
    const queued = await query('SELECT public_id FROM media_cleanup WHERE public_id=$1', [public_id]);
    if (!queued.rows.length) throw new ApiError(404, 'No queued cleanup for that asset.');
    const used = await query(`SELECT 1 FROM wallpapers WHERE public_id=$1 UNION ALL SELECT 1 FROM books WHERE cover_public_id=$1
      UNION ALL SELECT 1 FROM book_pages WHERE public_id=$1 UNION ALL SELECT 1 FROM dated_events WHERE image_public_id=$1`, [public_id]);
    if (used.rows.length) throw new ApiError(409, 'Asset is still referenced.');
    await query('UPDATE media_cleanup SET attempts=attempts+1 WHERE public_id=$1', [public_id]);
    await assetGateway.destroy(public_id);
    await query('DELETE FROM media_cleanup WHERE public_id=$1', [public_id]);
    return NextResponse.json({ message: 'Asset cleanup completed.' });
  } catch (error) { return failure(error); }
}, false, false);
