import { withAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';

async function handleGET() {
  return NextResponse.json({ 
    message: "Success! You have accessed a protected route." 
  });
}
export const GET = withAdmin(handleGET);
