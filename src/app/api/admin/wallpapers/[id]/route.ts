import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { v2 as cloudinary } from 'cloudinary';

// We must configure Cloudinary again here
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// This is the updated, more robust function signature that Vercel expects.
export async function DELETE(
  req: Request, 
  context: { params: { id: string } }
) {
  const { id } = context.params; // Extract the ID from the context object

  try {
    // 1. Find the wallpaper in the DB to get its Cloudinary public_id
    const findResult = await query('SELECT public_id FROM wallpapers WHERE id = $1', [id]);
    
    if (findResult.rows.length === 0) {
      return NextResponse.json({ message: 'Wallpaper not found.' }, { status: 404 });
    }
    const publicId = findResult.rows[0].public_id;

    // 2. Delete the image from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // 3. Delete the wallpaper record from our database
    await query('DELETE FROM wallpapers WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Wallpaper deleted successfully.' }, { status: 200 });

  } catch (error) {
    console.error('Failed to delete wallpaper:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}