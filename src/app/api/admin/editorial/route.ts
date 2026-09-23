import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { ApiError, failure, pageNumber } from '@/lib/api';
import { editorialTable, validateEditorialMetadata, validatePublication } from '@/lib/editorial';

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const table=editorialTable(req.nextUrl.searchParams.get('collection'));
    const page=pageNumber(req.nextUrl.searchParams.get('page'),1);
    const items=(await query(`SELECT * FROM ${table} ORDER BY updated_at DESC,id LIMIT 100 OFFSET $1`,[(page-1)*100])).rows;
    return NextResponse.json({items,page});
  } catch (error) { return failure(error); }
});
export const PUT = withAdmin(async (req: NextRequest) => {
  try {
    const body=await req.json();
    const table=editorialTable(body.collection);
    if (typeof body.id!=='string') throw new ApiError(400,'id required.');
    const row=(await query(`SELECT * FROM ${table} WHERE id::text=$1 FOR UPDATE`,[body.id])).rows[0];
    if (!row) throw new ApiError(404,'Record not found.');
    if (body.expected_revision!==row.revision) throw new ApiError(409,'Record changed. Reload and review again.');
    const action=body.action;
    if (!['metadata','review','publish','unpublish','archive'].includes(action)) throw new ApiError(400,'Unknown editorial action.');
    const patch=body.metadata ?? {};
    if (typeof patch!=='object' || Array.isArray(patch)) throw new ApiError(400,'metadata must be an object.');
    validateEditorialMetadata(table,patch);
    const merged={...row,...patch};
    if (action==='review' || action==='publish') await validatePublication(table,merged);
    if (action==='publish' && row.publication_state!=='review') throw new ApiError(409,'Review the content before publishing.');
    // Metadata changes to a reviewed record require a new review, not a publish in the same request.
    if (action==='publish' && Object.keys(patch).length) throw new ApiError(409,'Save and review metadata before publishing.');
    const state=action==='review'?'review':action==='publish'?'published':action==='unpublish'?'draft':action==='archive'?'archived':undefined;
    if (state) patch.publication_state=state;
    const fields=Object.keys(patch);
    if (!fields.length) return NextResponse.json(row);
    const result=(await query(`UPDATE ${table} SET ${fields.map((field,i)=>field+'=$'+(i+1)).join(',')},updated_at=now() WHERE id::text=$${fields.length+1} RETURNING *`,[...Object.values(patch),body.id])).rows[0];
    return NextResponse.json(result);
  } catch (error) { return failure(error); }
});
