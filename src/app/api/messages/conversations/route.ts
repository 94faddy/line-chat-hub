import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Conversation, LineChannel, LineUser, AdminPermission, Tag } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

// GET - ดึงรายการการสนทนาทั้งหมด (รวม owner + admin permissions)
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channel_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ดึง channel IDs ที่ user มีสิทธิ์เข้าถึง
    // 1. Channels ที่ user เป็นเจ้าของ
    const ownedChannels = await LineChannel.find({ user_id: userId }).select('_id').lean();
    const ownedChannelIds = ownedChannels.map(c => c._id);

    // 2. Channels จาก admin permissions
    const adminPermissions = await AdminPermission.find({
      admin_id: userId,
      status: 'active',
    }).select('channel_id owner_id').lean();

    const permittedChannelIds = adminPermissions
      .filter(p => p.channel_id)
      .map(p => p.channel_id);
    
    const permittedOwnerIds = adminPermissions
      .filter(p => !p.channel_id)
      .map(p => p.owner_id);

    // ดึง channels ของ owners ที่ได้รับสิทธิ์ทั้งหมด
    const ownerChannels = await LineChannel.find({
      user_id: { $in: permittedOwnerIds },
    }).select('_id').lean();

    const allAccessibleChannelIds = [
      ...ownedChannelIds,
      ...permittedChannelIds,
      ...ownerChannels.map(c => c._id),
    ];

    // Build query
    const query: any = {
      channel_id: { $in: allAccessibleChannelIds },
    };

    if (channelId) {
      query.channel_id = new mongoose.Types.ObjectId(channelId);
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    // ดึง conversations พร้อม populate
    let conversations = await Conversation.find(query)
      .populate('channel_id', 'channel_name picture_url basic_id')
      .populate('line_user_id', 'line_user_id display_name picture_url')
      .populate('tags', 'name color')
      .sort({ last_message_at: -1 })
      .lean();

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      conversations = conversations.filter((conv: any) => {
        const displayName = conv.line_user_id?.display_name?.toLowerCase() || '';
        const preview = conv.last_message_preview?.toLowerCase() || '';
        return displayName.includes(searchLower) || preview.includes(searchLower);
      });
    }

    // Format response
    const formattedConversations = conversations.map((conv: any) => ({
      id: conv._id,
      channel_id: conv.channel_id?._id,
      line_user_id: conv.line_user_id?._id,
      status: conv.status,
      last_message_preview: conv.last_message_preview,
      last_message_at: conv.last_message_at,
      unread_count: conv.unread_count,
      created_at: conv.created_at,
      channel: conv.channel_id ? {
        id: conv.channel_id._id,
        channel_name: conv.channel_id.channel_name,
        picture_url: conv.channel_id.picture_url,
        basic_id: conv.channel_id.basic_id,
      } : null,
      line_user: conv.line_user_id ? {
        id: conv.line_user_id._id,
        line_user_id: conv.line_user_id.line_user_id,
        display_name: conv.line_user_id.display_name,
        picture_url: conv.line_user_id.picture_url,
      } : null,
      tags: conv.tags || [],
    }));

    return NextResponse.json({ success: true, data: formattedConversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
