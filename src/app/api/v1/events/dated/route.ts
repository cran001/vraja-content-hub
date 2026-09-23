import { NextRequest, NextResponse } from 'next/server';
import { datedEventSelection } from '@/lib/eventSelection';
import { failure } from '@/lib/api';

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await datedEventSelection(req.nextUrl.searchParams),{headers:{
      'Cache-Control':'no-store','X-Reconciliation':'complete-requested-scope-retain-user-state',
      'X-Content-Timezone':'Asia/Kolkata',
    }});
  } catch(error){return failure(error);}
}
