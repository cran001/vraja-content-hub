import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // Select all wallpapers that are currently active
    const { rows } = await query(
      "SELECT * FROM wallpapers WHERE is_active = true ORDER BY created_at DESC"
    );

    return NextResponse.json(rows, { status: 200 });
    
  } catch (error) {
    console.error('Failed to fetch wallpapers:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}