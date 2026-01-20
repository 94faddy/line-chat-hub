import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { verifyTokenFromRequest } from '@/lib/auth';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

// POST - Upload avatar
export async function POST(request: NextRequest) {
  try {
    const user = verifyTokenFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const formData = await request.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB' }, { status: 400 });
    }

    // Create uploads directory if not exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const ext = path.extname(file.name) || '.jpg';
    const filename = `${user.id}_${Date.now()}${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Get old avatar to delete
    const oldUser = await User.findById(user.id).lean();
    const oldAvatar = oldUser?.avatar;

    // Update user avatar in database
    const avatarUrl = `/uploads/avatars/${filename}`;
    await User.findByIdAndUpdate(user.id, { avatar: avatarUrl });

    // Delete old avatar file if exists
    if (oldAvatar && oldAvatar.startsWith('/uploads/avatars/')) {
      const oldPath = path.join(process.cwd(), 'public', oldAvatar);
      if (existsSync(oldPath)) {
        try {
          await unlink(oldPath);
        } catch (e) {
          console.error('Failed to delete old avatar:', e);
        }
      }
    }

    return NextResponse.json({
      message: 'Avatar uploaded successfully',
      avatar: avatarUrl
    });
  } catch (error) {
    console.error('Upload avatar error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove avatar
export async function DELETE(request: NextRequest) {
  try {
    const user = verifyTokenFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Get current avatar
    const currentUser = await User.findById(user.id).lean();
    if (!currentUser?.avatar) {
      return NextResponse.json({ error: 'No avatar to delete' }, { status: 400 });
    }

    // Delete avatar file
    if (currentUser.avatar.startsWith('/uploads/avatars/')) {
      const avatarPath = path.join(process.cwd(), 'public', currentUser.avatar);
      if (existsSync(avatarPath)) {
        await unlink(avatarPath);
      }
    }

    // Update database
    await User.findByIdAndUpdate(user.id, { $unset: { avatar: 1 } });

    return NextResponse.json({ message: 'Avatar deleted successfully' });
  } catch (error) {
    console.error('Delete avatar error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
