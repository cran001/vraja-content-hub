import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Execute a simple query to get the current time from the database.
    const { rows } = await query('SELECT NOW()');

    // If the query is successful, return a success message and the time.
    return NextResponse.json({ 
      status: 'ok', 
      message: 'Database connection is successful.',
      db_time: rows[0].now 
    }, { status: 200 });

  } catch (error) {
    // If there is any error, return an error message.
    console.error(error); // Log the error to the terminal for debugging.
    return NextResponse.json({ 
      status: 'error', 
      message: 'Failed to connect to the database.' 
    }, { status: 500 });
  }
}