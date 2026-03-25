import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/v1/sponsors
 * Returns all active sponsor banners.
 * Android blends these into the wallpaper/darshan rotation as native images —
 * completely bypassing ad networks and Play Store ad SDK restrictions.
 */
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT
         id, title, name, original_url, thumbnail_url, public_id, created_at
       FROM wallpapers
       WHERE is_active  = true
         AND is_sponsor = true
       ORDER BY created_at DESC`,
      []
    );

    return NextResponse.json(rows, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch sponsors:', error);
    return NextResponse.json(
      { message: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
