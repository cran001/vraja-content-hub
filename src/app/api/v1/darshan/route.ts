import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/v1/darshan
 * Returns ONLY today's Darshan images.
 * The Android app calls this once per day; Vercel serves a tiny, curated response.
 */
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT
         id, title, name, original_url, thumbnail_url, public_id,
         visible_date, created_at
       FROM wallpapers
       WHERE is_active    = true
         AND content_type = 'darshan'
         AND visible_date = CURRENT_DATE
         AND (expires_on IS NULL OR expires_on > CURRENT_DATE)
       ORDER BY created_at DESC`,
      []
    );

    return NextResponse.json(
      { date: new Date().toISOString().split('T')[0], items: rows },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to fetch darshan:', error);
    return NextResponse.json(
      { message: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
