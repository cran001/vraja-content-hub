import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// THE FINAL, BRUTE-FORCE FIX:
// We are defining the 'context' object as a whole, and then extracting
// the id from it on a separate line inside the function.
// This is the most explicit and fundamental way to write this.
export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  const id = context.params.id;

  try {
    const findResult = await query('SELECT public_id FROM wallpapers WHERE id = $1', [id]);
    
    if (findResult.rows.length === 0) {
      return NextResponse.json({ message: 'Wallpaper not found.' }, { status: 404 });
    }
    const publicId = findResult.rows[0].public_id;

    await cloudinary.uploader.destroy(publicId);
    await query('DELETE FROM wallpapers WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Wallpaper deleted successfully.' }, { status: 200 });

  } catch (error) {
    console.error('Failed to delete wallpaper:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}
