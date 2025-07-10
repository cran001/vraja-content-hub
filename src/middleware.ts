import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return new NextResponse(
      JSON.stringify({ success: false, message: 'Authentication required.' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    );
  }

  // Ensure the JWT_SECRET is defined before using it
  const secretString = process.env.JWT_SECRET;
  if (!secretString) {
    throw new Error('JWT_SECRET is not defined in the environment variables.');
  }
  const secret = new TextEncoder().encode(secretString);

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    return new NextResponse(
      JSON.stringify({ success: false, message: 'Invalid token.' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    );
  }
}

// THIS IS THE ONLY CONFIG OBJECT THAT SHOULD BE IN THE FILE
export const config = {
  matcher: '/api/admin/:path*', // Protect all routes under /api/admin
};