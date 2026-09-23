import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { assetBatch } from '@/lib/mediaUpload';
import { ApiError, failure, uuid } from '@/lib/api';
import { contentText,contentPatch } from '@/lib/contentFields';

export const GET=withAdmin(async(req:NextRequest)=>{
  try {const id=uuid(req.nextUrl.searchParams.get('book_id'));return NextResponse.json({items:(await query('SELECT * FROM book_pages WHERE book_id=$1 ORDER BY page_number,id',[id])).rows});}
  catch(error){return failure(error);}
});
export const POST=withAdmin(async(req:NextRequest)=>{
  try{
    const form=await req.formData();const id=uuid(form.get('book_id'));
    if(!(await query('SELECT id FROM books WHERE id=$1',[id])).rows.length)throw new ApiError(404,'Book not found.');
    const images=Array.from(form.entries()).filter(([key,value])=>/^image_\d+$/.test(key)&&value instanceof File).sort((a,b)=>Number(a[0].slice(6))-Number(b[0].slice(6)));
    if(!images.length)throw new ApiError(400,'At least one image is required.');
    const metadata=images.map(([key])=>({title:contentText(form.get('title_'+key.slice(6)),'title',255),text:contentText(form.get('text_'+key.slice(6)),'caption',10000)}));
    const actor=req.headers.get('x-user-id')!;
    const result=await assetBatch(images.map(([,file])=>file as File),{type:'pages',book_id:id,metadata},actor,req.headers.get('Idempotency-Key')??'',async(assets)=>{
      await query('SELECT id FROM books WHERE id=$1 FOR UPDATE',[id]);
      const last=(await query('SELECT coalesce(max(page_number),0)::int AS last FROM book_pages WHERE book_id=$1',[id])).rows[0].last;
      const items=[];
      for(let i=0;i<assets.length;i++){
        const a=assets[i];const m=metadata[i];
        items.push((await query('INSERT INTO book_pages(book_id,page_number,title,body_text,public_id,image_url,thumbnail_url) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',[id,last+i+1,m.title??`Page ${last+i+1}`,m.text,a.public_id,a.original_url,a.thumbnail_url])).rows[0]);
      }
      return {items,message:`${items.length} pages saved.`};
    });
    return NextResponse.json(result,{status:201});
  }catch(error){return failure(error);}
},false,false);
export const PUT=withAdmin(async(req:NextRequest)=>{
  try{
    const body=await req.json();
    if(body.reorder){
      const id=uuid(body.reorder.book_id);const ids=body.reorder.ordered_ids;
      if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)throw new ApiError(400,'Each page id must appear exactly once.');
      ids.forEach(id=>uuid(id));
      await query('SELECT id FROM books WHERE id=$1 FOR UPDATE',[id]);
      const pages=(await query('SELECT id,page_number FROM book_pages WHERE book_id=$1',[id])).rows;
      if(pages.length!==ids.length||pages.some(p=>!ids.includes(p.id)))throw new ApiError(400,"Include all and only this book's pages.");
      const shift=Math.max(...pages.map(p=>p.page_number))+ids.length+1;
      await query('UPDATE book_pages SET page_number=page_number+$2 WHERE book_id=$1',[id,shift]);
      for(let i=0;i<ids.length;i++)await query('UPDATE book_pages SET page_number=$1,updated_at=now() WHERE id=$2',[i+1,ids[i]]);
      return NextResponse.json({items:(await query('SELECT * FROM book_pages WHERE book_id=$1 ORDER BY page_number',[id])).rows});
    }
    const id=uuid(body.id);const patch=contentPatch(body,['body_text','title_hi','body_text_hi'],['title'],['is_active']);
    const fields=Object.keys(patch);
    const result=fields.length?await query(`UPDATE book_pages SET ${fields.map((f,i)=>f+'=$'+(i+1)).join(',')},updated_at=now() WHERE id=$${fields.length+1} RETURNING *`,[...Object.values(patch),id]):await query('SELECT * FROM book_pages WHERE id=$1',[id]);
    if(!result.rows.length)throw new ApiError(404,'Page not found.');return NextResponse.json(result.rows[0]);
  }catch(error){return failure(error);}
});
export const DELETE=withAdmin(async(req:NextRequest)=>{
  try{
    const id=uuid(req.nextUrl.searchParams.get('id'));
    const row=(await query('SELECT * FROM book_pages WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!row)throw new ApiError(404,'Page not found.');
    if(req.nextUrl.searchParams.get('confirm')!==id)throw new ApiError(409,'Confirm the exact page id.',{id,title:row.title,book_id:row.book_id});
    await query("INSERT INTO media_cleanup(public_id,reason) VALUES ($1,'page_deleted') ON CONFLICT DO NOTHING",[row.public_id]);
    await query('DELETE FROM book_pages WHERE id=$1',[id]);
    return NextResponse.json({message:'Page deleted; asset cleanup queued.'});
  }catch(error){return failure(error);}
});
