import { NextResponse, NextRequest } from 'next/server'; // Import NextRequest
import { query } from '@/lib/db';

export async function GET(request: NextRequest) { // Add the request object as an argument
  try {
    // Get the 'category' query parameter from the URL.
    const category = request.nextUrl.searchParams.get('category');

    // Start building our SQL query and the array of parameters.
    let sqlQuery = 'SELECT * FROM wallpapers WHERE is_active = true';
    const queryParams = [];

    // If a category was provided in the URL, add it to our query.
    if (category) {
      sqlQuery += ' AND category = $1'; // Add the filter condition
      queryParams.push(category);     // Add the category value to our parameters
    }

    // Always order the results by the newest first.
    sqlQuery += ' ORDER BY created_at DESC';

    // Execute the final, dynamically built query.
    const { rows } = await query(sqlQuery, queryParams);

    return NextResponse.json(rows, { status: 200 });
    
  } catch (error) {
    console.error('Failed to fetch wallpapers:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}