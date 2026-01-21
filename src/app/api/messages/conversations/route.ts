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

    // ดึง channel IDs ที่ user เป็น owner
    const ownedChannels = await LineChannel.find({ user_id: userId }).select('_id');
    const ownedChannelIds = ownedChannels.map(ch => ch._id);

    // ดึง admin permissions
    const adminPerms = await AdminPermission.find({
      admin_id: userId,
      status: 'active'
    });

    // รวม channel IDs ที่มีสิทธิ์เข้าถึง
    let accessibleChannelIds = [...ownedChannelIds];
    
    for (const perm of adminPerms) {
      if (perm.channel_id) {
        // มีสิทธิ์เข้าถึง specific channel
        accessibleChannelIds.push(perm.channel_id);
      } else if (perm.owner_id) {
        // มีสิทธิ์เข้าถึงทุก channel ของ owner
        const ownerChannels = await LineChannel.find({ user_id: perm.owner_id }).select('_id');
        accessibleChannelIds.push(...ownerChannels.map(ch => ch._id));
      }
    }

    // สร้าง query
    let query: any = {
      channel_id: { $in: accessibleChannelIds }
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
      .populate('line_user_id', 'line_user_id display_name picture_url follow_status source_type group_id room_id member_count')
      .populate('tags', 'name color')
      .sort({ last_message_at: -1 })
      .lean();

    // Filter out Unknown/null display_name by default (unless show_unknown=true)
    const showUnknown = searchParams.get('show_unknown') === 'true';
    if (!showUnknown) {
      conversations = conversations.filter(conv => {
        const lineUser = conv.line_user_id as any;
        const displayName = lineUser?.display_name;
        return displayName && displayName !== 'Unknown' && displayName.trim() !== '';
      });
    }

    // Filter by search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      conversations = conversations.filter(conv => {
        const lineUser = conv.line_user_id as any;
        const displayName = lineUser?.display_name?.toLowerCase() || '';
        const preview = conv.last_message_preview?.toLowerCase() || '';
        return displayName.includes(searchLower) || preview.includes(searchLower);
      });
    }

    // แปลงรูปแบบข้อมูล
    const formattedConversations = conversations.map(conv => ({
      id: conv._id,
      channel_id: (conv.channel_id as any)?._id,
      line_user_id: (conv.line_user_id as any)?._id,
      status: conv.status,
      last_message_preview: conv.last_message_preview,
      last_message_at: conv.last_message_at,
      unread_count: conv.unread_count,
      created_at: conv.created_at,
      channel: {
        id: (conv.channel_id as any)?._id,
        channel_name: (conv.channel_id as any)?.channel_name,
        picture_url: (conv.channel_id as any)?.picture_url,
        basic_id: (conv.channel_id as any)?.basic_id
      },
      line_user: {
        id: (conv.line_user_id as any)?._id,
        line_user_id: (conv.line_user_id as any)?.line_user_id,
        display_name: (conv.line_user_id as any)?.display_name,
        picture_url: (conv.line_user_id as any)?.picture_url,
        follow_status: (conv.line_user_id as any)?.follow_status || 'unknown',
        // ✅ เพิ่มข้อมูล group/room
        source_type: (conv.line_user_id as any)?.source_type || 'user',
        group_id: (conv.line_user_id as any)?.group_id,
        room_id: (conv.line_user_id as any)?.room_id,
        member_count: (conv.line_user_id as any)?.member_count
      },
      tags: (conv.tags || []).map((tag: any) => ({
        id: tag._id,
        name: tag.name,
        color: tag.color
      }))
    }));

    return NextResponse.json({ success: true, data: formattedConversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}