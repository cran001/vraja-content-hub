import { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function POST(req: Request) {
  try {
    // 1. Get email and password from the request body
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required.' }, { status: 400 });
    }

    // 2. Find the user in the database
    const userResult = await query('SELECT * FROM admins WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      // Use a generic message to avoid revealing which emails are registered
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }
    const user = userResult.rows[0];

    // 3. Compare the provided password with the stored hash
    const passwordsMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordsMatch) {
      return NextResponse.json({ message: 'Invalid credentials.' }, { status: 401 });
    }

    // 4. Check for the JWT secret
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    
    // 5. Create the JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // The token will be valid for 1 hour
    );

    // 6. Return the token and user info
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    }, { status: 200 });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}