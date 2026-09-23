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

  const secretString = process.env.JWT_SECRET;
  if (!secretString) {
    throw new Error('JWT_SECRET is not defined in the environment variables.');
  }
  const secret = new TextEncoder().encode(secretString);

  try {
    await jwtVerify(token, secret, { algorithms: ['HS256'] });

    // Inject user context into headers so downstream route handlers
    // can read author identity without re-decoding the token.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete('x-user-id');
    requestHeaders.delete('x-user-role');
    requestHeaders.delete('x-user-email');

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return new NextResponse(
      JSON.stringify({ success: false, message: 'Invalid token.' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    );
  }
}

export const config = {
  matcher: '/api/admin/:path*',
};
