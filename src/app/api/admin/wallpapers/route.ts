import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { query } from '@/lib/db';

// Configure Cloudinary using our environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(req: Request) {
  try {
    // 1. Parse the incoming form data
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    const name = formData.get('name') as string;
    const category = formData.get('category') as string;

    if (!file || !name || !category) {
      return NextResponse.json({ message: 'Missing required fields (image, name, category).' }, { status: 400 });
    }

    // 2. Convert the file to a buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 3. Upload the image to Cloudinary
    // We need to use a "data URI" format for Cloudinary to accept the buffer.
    const base64String = buffer.toString('base64');
    const dataUri = `data:${file.type};base64,${base64String}`;
    
    const uploadResponse = await cloudinary.uploader.upload(dataUri, {
      folder: 'vraja-realm-wallpapers', // Optional: puts all uploads in a specific folder
    });

    // 4. Generate a standard thumbnail URL from the Cloudinary response
    const thumbnailUrl = cloudinary.url(uploadResponse.public_id, {
      width: 400,
      height: 300,
      crop: 'fill', // Creates a nicely cropped thumbnail
    });
    
    // 5. Save wallpaper metadata to our PostgreSQL database
    const dbResult = await query(
      `INSERT INTO wallpapers (name, category, public_id, original_url, thumbnail_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, // "RETURNING *" sends back the row that was just created
      [name, category, uploadResponse.public_id, uploadResponse.secure_url, thumbnailUrl]
    );

    const newWallpaper = dbResult.rows[0];

    // 6. Return the newly created wallpaper data
    return NextResponse.json(newWallpaper, { status: 201 });

  } catch (error) {
    console.error('Failed to upload wallpaper:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}