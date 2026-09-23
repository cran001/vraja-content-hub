import { createHash } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { inTransaction, query } from './db';
import { ApiError } from './api';
import { validateMediaPatch } from './media';

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });

export async function checkedImage(file: File): Promise<Buffer> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size < 12 || file.size > 8 * 1024 * 1024) throw new ApiError(400, 'Images must be JPEG, PNG or WebP, up to 8 MiB each.');
  const buffer = Buffer.from(await file.arrayBuffer());
  const matches = file.type === 'image/jpeg' ? buffer.subarray(0,3).equals(Buffer.from([255,216,255]))
    : file.type === 'image/png' ? buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP';
  if (!matches) throw new ApiError(400, 'Image signature does not match its content type.');
  return buffer;
}
export const assetGateway = {
  async upload(buffer: Buffer, type: string, publicId: string) {
    const result = await cloudinary.uploader.upload(`data:${type};base64,${buffer.toString('base64')}`, {
      public_id: publicId, overwrite: false, resource_type: 'image',
    });
    return { public_id: result.public_id, original_url: result.secure_url, image_width: result.width,
      image_height: result.height, thumbnail_url: cloudinary.url(result.public_id, { width: 400, height: 600, crop: 'limit', secure: true }) };
  },
  async destroy(publicId: string) {
    const result = await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: 'image' });
    if (!['ok','not found'].includes(result.result)) throw new Error('Cleanup failed');
  },
};
export type AssetGateway = typeof assetGateway;

/** The ledger is committed BEFORE contacting the asset service. Deterministic IDs make
 * interruption recovery possible even if the upload succeeded but its response was lost. */
export async function uploadMedia(form: FormData, actor: string, key: string, gateway: AssetGateway = assetGateway) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new ApiError(400, 'Send an Idempotency-Key of 8–100 letters, digits, underscores or hyphens.');
  const entries = Array.from(form.entries());
  const files = entries.filter(([name,value]) => name.startsWith('image') && value instanceof File).map(([,value]) => value as File);
  if (!files.length || files.length > 20 || files.reduce((sum,f) => sum+f.size,0) > 32*1024*1024) throw new ApiError(400, 'Upload 1–20 images, at most 32 MiB in total.');
  const buffers = await Promise.all(files.map(checkedImage));
  const input: Record<string, unknown> = { name: 'Untitled', content_type: 'wallpaper', is_sponsor: false };
  for (const [name,value] of entries) {
    if (value instanceof File) continue;
    input[name] = ['is_active','is_sponsor'].includes(name) ? value === 'true' ? true : value === 'false' ? false : value : value || null;
  }
  const metadata = await validateMediaPatch(input);
  const fingerprint = createHash('sha256').update(JSON.stringify(metadata))
    .update(JSON.stringify(files.map(file => ({ type: file.type, size: file.size }))))
    .update(Buffer.concat(buffers)).digest('hex');
  const publicIds = files.map((_,index) => `vraja-hub/${actor}/${key}/${index}`);
  const inserted = await query(`INSERT INTO media_uploads(id,actor_id,fingerprint,state,public_ids)
    VALUES ($1,$2,$3,'pending',$4::jsonb) ON CONFLICT DO NOTHING RETURNING id`, [key,actor,fingerprint,JSON.stringify(publicIds)]);
  if (!inserted.rowCount) {
    const previous = (await query('SELECT * FROM media_uploads WHERE id=$1', [key])).rows[0];
    if (previous.actor_id !== actor || previous.fingerprint !== fingerprint) throw new ApiError(409, 'Idempotency key was already used for different content.');
    if (previous.state === 'complete') return previous.result;
    throw new ApiError(409, 'Upload is pending or requires cleanup. Inspect its ledger before retrying with a new key.', { upload_id: key, state: previous.state });
  }
  try {
    const assets: Awaited<ReturnType<AssetGateway['upload']>>[] = [];
    for (let index=0; index<files.length; index++) assets.push(await gateway.upload(buffers[index], files[index].type, publicIds[index]));
    return await inTransaction(async () => {
      const ledger=(await query('SELECT state FROM media_uploads WHERE id=$1 FOR UPDATE',[key])).rows[0];
      if(ledger?.state!=='pending')throw new ApiError(409,'Upload was moved to recovery; its assets cannot be published.');
      const items = [];
      for (let index=0; index<assets.length; index++) {
        const values = { ...metadata, ...assets[index], name: files.length > 1 ? `${metadata.name} ${index+1}` : metadata.name,
          author_id: actor, upload_key: `${key}:${index}` };
        const fields = Object.keys(values);
        const row = (await query(`INSERT INTO wallpapers (${fields.join(',')}) VALUES (${fields.map((_,i) => '$'+(i+1)).join(',')}) RETURNING *`, Object.values(values))).rows[0];
        items.push(row);
      }
      const result = { upload_id: key, state: 'complete', items, message: `${items.length} image(s) saved as drafts.` };
      await query("UPDATE media_uploads SET state='complete',result=$2::jsonb,updated_at=now() WHERE id=$1", [key,JSON.stringify(result)]);
      return result;
    }, actor);
  } catch {
    // A lost COMMIT response is ambiguous. Lock the ledger on a fresh connection before
    // compensation; a completed batch must retain both its records and assets.
    let committed;
    try { committed=(await query('SELECT state,result FROM media_uploads WHERE id=$1 FOR UPDATE',[key])).rows[0]; }
    catch { throw new ApiError(503,'Upload outcome is uncertain. Keep the same key and inspect the ledger before retrying.',{upload_id:key}); }
    if(committed?.state==='complete')return committed.result;
    const cleanup = [];
    for (const publicId of publicIds) {
      try { await gateway.destroy(publicId); cleanup.push({ public_id: publicId, state: 'removed' }); }
      catch {
        await query("INSERT INTO media_cleanup(public_id,reason) VALUES ($1,'upload_failed') ON CONFLICT DO NOTHING", [publicId]);
        cleanup.push({ public_id: publicId, state: 'cleanup_required' });
      }
    }
    const state = cleanup.some(r => r.state === 'cleanup_required') ? 'cleanup_required' : 'failed';
    await query('UPDATE media_uploads SET state=$2,result=$3::jsonb,updated_at=now() WHERE id=$1', [key,state,JSON.stringify({ cleanup })]);
    throw new ApiError(502, 'Upload batch failed. No media records were saved.', { upload_id: key, state, cleanup });
  }
}

/** Atomic, idempotent asset batch for book covers, pages and dated-event banners. */
export async function assetBatch<T>(files: File[], context: unknown, actor: string, key: string,
  save: (assets: Awaited<ReturnType<AssetGateway['upload']>>[]) => Promise<T>, gateway: AssetGateway = assetGateway): Promise<T> {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new ApiError(400,'A valid Idempotency-Key is required.');
  if (files.length>20 || files.reduce((sum,f)=>sum+f.size,0)>32*1024*1024) throw new ApiError(400,'At most 20 images and 32 MiB per batch.');
  const buffers=await Promise.all(files.map(checkedImage));
  const fingerprint=createHash('sha256').update(JSON.stringify(context)).update(JSON.stringify(files.map(f=>[f.size,f.type]))).update(Buffer.concat(buffers)).digest('hex');
  const ids=files.map((_,i)=>`vraja-hub/${actor}/${key}/${i}`);
  const added=await query("INSERT INTO media_uploads(id,actor_id,fingerprint,state,public_ids) VALUES ($1,$2,$3,'pending',$4::jsonb) ON CONFLICT DO NOTHING RETURNING id",[key,actor,fingerprint,JSON.stringify(ids)]);
  if (!added.rowCount) {
    const prior=(await query('SELECT * FROM media_uploads WHERE id=$1',[key])).rows[0];
    if(prior.actor_id!==actor||prior.fingerprint!==fingerprint)throw new ApiError(409,'Upload key conflicts with a different request.');
    if(prior.state==='complete')return prior.result;
    throw new ApiError(409,'An earlier upload needs inspection or cleanup.',{upload_id:key,state:prior.state});
  }
  try {
    const assets: Awaited<ReturnType<AssetGateway['upload']>>[]=[];
    for(let i=0;i<files.length;i++) assets.push(await gateway.upload(buffers[i],files[i].type,ids[i]));
    return await inTransaction(async()=>{
      const ledger=(await query('SELECT state FROM media_uploads WHERE id=$1 FOR UPDATE',[key])).rows[0];
      if(ledger?.state!=='pending')throw new ApiError(409,'Upload was moved to recovery; save cancelled.');
      const result=await save(assets);
      await query("UPDATE media_uploads SET state='complete',result=$2::jsonb,updated_at=now() WHERE id=$1",[key,JSON.stringify(result)]);
      return result;
    },actor);
  } catch(error) {
    let committed;
    try { committed=(await query('SELECT state,result FROM media_uploads WHERE id=$1 FOR UPDATE',[key])).rows[0]; }
    catch { throw new ApiError(503,'Upload outcome is uncertain. Inspect the ledger using the same key.',{upload_id:key}); }
    if(committed?.state==='complete')return committed.result;
    let pending=false;
    for(const id of ids) {
      try{await gateway.destroy(id);}catch{pending=true;await query("INSERT INTO media_cleanup(public_id,reason) VALUES ($1,'asset_batch_failed') ON CONFLICT DO NOTHING",[id]);}
    }
    await query('UPDATE media_uploads SET state=$2,updated_at=now() WHERE id=$1',[key,pending?'cleanup_required':'failed']);
    if(error instanceof ApiError)throw error;
    throw new ApiError(502,'Asset batch failed; database changes rolled back.',{upload_id:key,cleanup_pending:pending});
  }
}
