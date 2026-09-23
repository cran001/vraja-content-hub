import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
export const GET=withAdmin(async req=>NextResponse.json({id:req.headers.get('x-user-id'),role:req.headers.get('x-user-role')}),true);
