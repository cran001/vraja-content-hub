import { NextResponse, NextRequest } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { query } from '@/lib/db';

// Configure Cloudinary (this applies to all functions in this file)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// --- UPLOAD A NEW WALLPAPER ---
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    const name = formData.get('name') as string;
    const category = formData.get('category') as string;

    if (!file || !name || !category) {
      return NextResponse.json({ message: 'Missing required fields (image, name, category).' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const base64String = buffer.toString('base64');
    const dataUri = `data:${file.type};base64,${base64String}`;
    
    const uploadResponse = await cloudinary.uploader.upload(dataUri, {
      folder: 'vraja-realm-wallpapers',
    });

    const thumbnailUrl = cloudinary.url(uploadResponse.public_id, {
      width: 400,
      height: 300,
      crop: 'fill',
    });
    
    const dbResult = await query(
      `INSERT INTO wallpapers (name, category, public_id, original_url, thumbnail_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, category, uploadResponse.public_id, uploadResponse.secure_url, thumbnailUrl]
    );

    const newWallpaper = dbResult.rows[0];
    return NextResponse.json(newWallpaper, { status: 201 });

  } catch (error) {
    console.error('Failed to upload wallpaper:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}

// --- DELETE A WALLPAPER ---
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ message: 'Wallpaper ID is required.' }, { status: 400 });
    }

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

// --- UPDATE A WALLPAPER ---
export async function PUT(req: NextRequest) {
  try {
    const { id, name, category } = await req.json();

    if (!id || !name || !category) {
      return NextResponse.json({ message: 'Missing required fields (id, name, category).' }, { status: 400 });
    }

    const dbResult = await query(
      `UPDATE wallpapers
       SET name = $1, category = $2, updated_at = current_timestamp
       WHERE id = $3
       RETURNING *`,
      [name, category, id]
    );

    if (dbResult.rows.length === 0) {
      return NextResponse.json({ message: 'Wallpaper not found.' }, { status: 404 });
    }

    const updatedWallpaper = dbResult.rows[0];
    return NextResponse.json(updatedWallpaper, { status: 200 });

  } catch (error) {
    console.error('Failed to update wallpaper:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
}