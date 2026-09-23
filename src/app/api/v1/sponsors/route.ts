import { NextRequest, NextResponse } from 'next/server';
import { publicMedia } from '@/lib/media';
import { failure } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    const result = await publicMedia(req.nextUrl.searchParams, 'sponsor');
    return NextResponse.json(result.items, { headers: {
      'Cache-Control': 'no-cache', 'X-Content-Day': result.day, 'X-Content-Timezone': 'Asia/Kolkata',
      'X-Reconciliation': result.paginated?'page-only':'complete-requested-scope',
      ...(result.paginated?{'X-Page': String(result.page), 'X-Limit': String(result.limit)}:{}),
    } });
  } catch (error) { return failure(error); }
}
