//PATH: src/app/api/channels/[id]/admins/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { LineChannel, User, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

// GET - Get all admins who have access to this channel
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id: channelId } = await params;

    // Check if channel exists
    const channel = await LineChannel.findById(channelId);
    if (!channel) {
      return NextResponse.json({ success: false, message: 'Channel not found' }, { status: 404 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);
    const ownerId = channel.user_id;

    // Verify user has access to this channel
    const isOwner = ownerId.equals(userId);
    if (!isOwner) {
      const hasPermission = await AdminPermission.findOne({
        admin_id: userId,
        owner_id: ownerId,
        status: 'active',
        $or: [
          { channel_id: channelId },
          { channel_id: null } // Owner-wide permission
        ]
      });
      
      if (!hasPermission) {
        return NextResponse.json({ success: false, message: 'Access denied' }, { status: 403 });
      }
    }

    // Get the owner
    const owner = await User.findById(ownerId).select('name email avatar');
    
    const admins: Array<{ id: string; name: string; email: string; avatar?: string; role: string }> = [];
    const adminIds = new Set<string>();

    // Add owner first
    if (owner) {
      admins.push({
        id: owner._id.toString(),
        name: owner.name,
        email: owner.email,
        avatar: owner.avatar,
        role: 'owner'
      });
      adminIds.add(owner._id.toString());
    }

    // Get all active admins with permissions for this channel (from this owner)
    const permissions = await AdminPermission.find({
      owner_id: ownerId,
      status: 'active',
      admin_id: { $exists: true, $ne: null },
      $or: [
        { channel_id: new mongoose.Types.ObjectId(channelId) },
        { channel_id: null } // Owner-wide permission
      ]
    }).populate('admin_id', 'name email avatar');

    // Add admins
    for (const perm of permissions) {
      const adminUser = perm.admin_id as any;
      if (adminUser && adminUser._id && !adminIds.has(adminUser._id.toString())) {
        admins.push({
          id: adminUser._id.toString(),
          name: adminUser.name || 'Unknown',
          email: adminUser.email || '',
          avatar: adminUser.avatar,
          role: 'admin'
        });
        adminIds.add(adminUser._id.toString());
      }
    }

    return NextResponse.json({ success: true, data: admins });

  } catch (error) {
    console.error('Error fetching channel admins:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch admins' },
      { status: 500 }
    );
  }
}