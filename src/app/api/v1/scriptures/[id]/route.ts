import { NextRequest } from 'next/server';
import { inTransaction } from '@/lib/db';
import { gzippedJson } from '@/lib/httpJson';
import { scriptureSnapshot } from '@/lib/scriptureSnapshots';
import { isScriptureSlug } from '@/lib/scriptures';
import { ApiError, failure } from '@/lib/api';

export async function GET(req: NextRequest, {params}: {params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    if (!isScriptureSlug(id)) throw new ApiError(400,'Invalid scripture id.');
    return await inTransaction(async () => {
      const snapshot=await scriptureSnapshot(id);
      const version=req.nextUrl.searchParams.get('version');
      const hash=req.nextUrl.searchParams.get('hash');
      if ((version!==null && version!==String(snapshot.version)) || (hash!==null && hash!==snapshot.hash)) throw new ApiError(409,'Catalogue changed. Fetch the catalogue again; do not mark this version installed.');
      return gzippedJson(snapshot.body,req,{headers:{'Cache-Control':'no-store','X-Scripture-Version':String(snapshot.version),'X-Content-SHA256':snapshot.hash,ETag:'"'+snapshot.hash+'"'}});
    });
  } catch (error) { return failure(error); }
}
