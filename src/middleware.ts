import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// This is the main middleware function that will be executed.
export async function middleware(request: NextRequest) {
  // 1. Get the token from the Authorization header.
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.split(' ')[1]; // Format is "Bearer TOKEN"

  // 2. If no token is found, return an unauthorized error.
  if (!token) {
    return new NextResponse(
      JSON.stringify({ success: false, message: 'Authentication required.' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    );
  }

  // 3. Get the secret key and verify the token.
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);

  try {
    // We use 'jose' library here as it's the recommended one for Next.js Edge runtime.
    await jwtVerify(token, secret);
    // If verification is successful, the request can proceed.
    return NextResponse.next();
  } catch (error) {
    // If token verification fails, return an invalid token error.
    return new NextResponse(
      JSON.stringify({ success: false, message: 'Invalid token.' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    );
  }
}

// This config specifies which routes the middleware should run on.
export const config = {
  matcher: '/api/admin/:path*', // Protect all routes under /api/admin
};