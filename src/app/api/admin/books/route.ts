import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { assetBatch } from '@/lib/mediaUpload';
import { ApiError, failure, uuid } from '@/lib/api';
import { contentText,contentInteger,contentPatch } from '@/lib/contentFields';

export const GET=withAdmin(async()=>NextResponse.json({items:(await query('SELECT b.*,(SELECT count(*)::int FROM book_pages p WHERE p.book_id=b.id) AS page_count FROM books b ORDER BY sort_order,created_at DESC')).rows}));
export const POST=withAdmin(async(req:NextRequest)=>{
  try {
    const form=await req.formData();
    const title=contentText(form.get('title'),'title',255,true);
    const description=contentText(form.get('description'),'description');
    const order=contentInteger(form.get('sort_order'),'sort_order');
    const files=Array.from(form.values()).filter(v=>v instanceof File && v.size>0) as File[];
    if(files.length>1)throw new ApiError(400,'A book has at most one cover image.');
    const actor=req.headers.get('x-user-id')!;
    const result=await assetBatch(files,{type:'book',title,description,order},actor,req.headers.get('Idempotency-Key')??'',async(assets)=>{
      const cover=assets[0];
      return (await query('INSERT INTO books(title,description,sort_order,cover_public_id,cover_url,author_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *,0 AS page_count',[title,description,order,cover?.public_id??null,cover?.original_url??null,actor])).rows[0];
    });
    return NextResponse.json(result,{status:201});
  }catch(error){return failure(error);}
},false,false);
export const PUT=withAdmin(async(req:NextRequest)=>{
  try{
    const body=await req.json();const id=uuid(body.id);
    const patch=contentPatch(body,['description'],['title'],['is_active'],['sort_order']);
    const fields=Object.keys(patch);
    const result=fields.length?await query(`UPDATE books SET ${fields.map((f,i)=>f+'=$'+(i+1)).join(',')},updated_at=now() WHERE id=$${fields.length+1} RETURNING *`,[...Object.values(patch),id]):await query('SELECT * FROM books WHERE id=$1',[id]);
    if(!result.rows.length)throw new ApiError(404,'Book not found.');
    return NextResponse.json(result.rows[0]);
  }catch(error){return failure(error);}
});
export const DELETE=withAdmin(async(req:NextRequest)=>{
  try{
    const id=uuid(req.nextUrl.searchParams.get('id'));
    const book=(await query('SELECT * FROM books WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!book)throw new ApiError(404,'Book not found.');
    const pages=(await query('SELECT id,title,page_number FROM book_pages WHERE book_id=$1 ORDER BY page_number',[id])).rows;
    if(pages.length || book.is_story || req.nextUrl.searchParams.get('confirm')!==id)throw new ApiError(409,'Archive story books. Delete pages explicitly before deleting an empty book.',{id,title:book.title,is_story:book.is_story,pages});
    if(book.cover_public_id)await query("INSERT INTO media_cleanup(public_id,reason) VALUES ($1,'book_deleted') ON CONFLICT DO NOTHING",[book.cover_public_id]);
    await query('DELETE FROM books WHERE id=$1',[id]);
    return NextResponse.json({message:'Empty book deleted; asset cleanup queued.'});
  }catch(error){return failure(error);}
});
