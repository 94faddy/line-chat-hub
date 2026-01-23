// src/app/api/quick-replies/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { QuickReply, LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

// ✅ เพิ่ม filter status: 'active' ทุกที่
async function getAccessibleChannelIds(userId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId[]> {
  // ✅ เฉพาะ active channels
  const ownedChannels = await LineChannel.find({ 
    user_id: userId,
    status: 'active' // ✅ เพิ่ม filter
  }).select('_id').lean();
  const ownedChannelIds = ownedChannels.map(ch => ch._id);

  const permissions = await AdminPermission.find({ 
    admin_id: userId, 
    status: 'active',
    channel_id: { $ne: null }
  }).select('channel_id').lean();
  
  // ✅ Filter เฉพาะ active channels จาก permissions
  const permittedChannelIds: mongoose.Types.ObjectId[] = [];
  for (const p of permissions) {
    const activeChannel = await LineChannel.findOne({
      _id: p.channel_id,
      status: 'active'
    }).select('_id').lean();
    if (activeChannel) {
      permittedChannelIds.push(p.channel_id!);
    }
  }

  const allChannelPermissions = await AdminPermission.find({
    admin_id: userId,
    status: 'active',
    channel_id: null
  }).select('owner_id').lean();
  
  const ownerIds = allChannelPermissions.map(p => p.owner_id);
  // ✅ เฉพาะ active channels ของ owners
  const ownerChannels = await LineChannel.find({ 
    user_id: { $in: ownerIds },
    status: 'active' // ✅ เพิ่ม filter
  }).select('_id').lean();
  const ownerChannelIds = ownerChannels.map(ch => ch._id);

  const allChannelIds = [...ownedChannelIds, ...permittedChannelIds, ...ownerChannelIds];
  const uniqueIds = Array.from(new Map(allChannelIds.map(id => [id.toString(), id])).values());
  
  return uniqueIds;
}

// ✅ เพิ่ม filter status: 'active'
async function hasChannelAccess(userId: mongoose.Types.ObjectId, channelId: mongoose.Types.ObjectId): Promise<boolean> {
  // ✅ ตรวจสอบว่า channel ยัง active อยู่ก่อน
  const activeChannel = await LineChannel.findOne({
    _id: channelId,
    status: 'active'
  });
  if (!activeChannel) return false;

  const isOwner = await LineChannel.exists({ 
    _id: channelId, 
    user_id: userId,
    status: 'active' // ✅ เพิ่ม filter
  });
  if (isOwner) return true;

  const hasDirectPermission = await AdminPermission.exists({
    admin_id: userId,
    channel_id: channelId,
    status: 'active'
  });
  if (hasDirectPermission) return true;

  const channel = await LineChannel.findById(channelId).select('user_id').lean();
  if (channel) {
    const hasAllChannelPermission = await AdminPermission.exists({
      admin_id: userId,
      owner_id: channel.user_id,
      channel_id: null,
      status: 'active'
    });
    if (hasAllChannelPermission) return true;
  }

  return false;
}

function normalizeQuickReply(qr: any) {
  if (qr.messages && qr.messages.length > 0) {
    return {
      id: qr._id,
      title: qr.title,
      shortcut: qr.shortcut,
      messages: qr.messages,
      channel_id: qr.channel_id,
      is_active: qr.is_active,
      use_count: qr.use_count,
      sort_order: qr.sort_order || 0,
      created_by: qr.created_by,
      created_at: qr.created_at
    };
  }
  
  const legacyMessage = {
    type: qr.message_type || 'text',
    content: qr.content || '',
    flex_content: qr.flex_content || null,
    media_url: qr.media_url || null
  };
  
  return {
    id: qr._id,
    title: qr.title,
    shortcut: qr.shortcut,
    messages: [legacyMessage],
    message_type: qr.message_type,
    content: qr.content,
    flex_content: qr.flex_content,
    media_url: qr.media_url,
    channel_id: qr.channel_id,
    is_active: qr.is_active,
    use_count: qr.use_count,
    sort_order: qr.sort_order || 0,
    created_by: qr.created_by,
    created_at: qr.created_at
  };
}

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

    const userId = new mongoose.Types.ObjectId(payload.userId);
    const accessibleChannelIds = await getAccessibleChannelIds(userId);

    if (accessibleChannelIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const quickReplies = await QuickReply.find({ 
      channel_id: { $in: accessibleChannelIds },
      is_active: true 
    })
      .sort({ channel_id: 1, sort_order: 1, created_at: 1 })
      .lean();

    // ✅ เฉพาะ active channels
    const channels = await LineChannel.find({ 
      _id: { $in: accessibleChannelIds },
      status: 'active' // ✅ เพิ่ม filter (แม้ว่า accessibleChannelIds จะ filter แล้วก็ตาม)
    })
      .select('_id channel_name')
      .lean();
    
    const channelMap = new Map(channels.map(ch => [ch._id.toString(), ch.channel_name]));

    const formattedReplies = quickReplies.map(qr => {
      const normalized = normalizeQuickReply(qr);
      return {
        ...normalized,
        channel_name: channelMap.get(qr.channel_id.toString()) || null
      };
    });

    return NextResponse.json({ success: true, data: formattedReplies });
  } catch (error) {
    console.error('Get quick replies error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { title, shortcut, messages, channel_id } = body;

    if (!channel_id) {
      return NextResponse.json({ success: false, message: 'กรุณาเลือก LINE Channel' }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกชื่อ' }, { status: 400 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: false, message: 'กรุณาเพิ่มอย่างน้อย 1 ข้อความ' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);
    const channelObjectId = new mongoose.Types.ObjectId(channel_id);

    // ✅ hasChannelAccess จะตรวจสอบ active status แล้ว
    const hasAccess = await hasChannelAccess(userId, channelObjectId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึง Channel นี้ หรือ Channel ถูกปิดใช้งานแล้ว' }, { status: 403 });
    }

    const maxSortOrder = await QuickReply.findOne({ channel_id: channelObjectId })
      .sort({ sort_order: -1 })
      .select('sort_order')
      .lean();
    
    const newSortOrder = (maxSortOrder?.sort_order || 0) + 1;

    const newQuickReply = new QuickReply({
      channel_id: channelObjectId,
      created_by: userId,
      title,
      shortcut: shortcut || null,
      messages: messages,
      is_active: true,
      use_count: 0,
      sort_order: newSortOrder
    });

    await newQuickReply.save();

    const channel = await LineChannel.findById(channelObjectId).select('channel_name').lean();

    return NextResponse.json({
      success: true,
      message: 'สร้างข้อความตอบกลับสำเร็จ',
      data: { 
        id: newQuickReply._id,
        channel_id: channelObjectId,
        channel_name: channel?.channel_name,
        sort_order: newSortOrder
      }
    });
  } catch (error) {
    console.error('Create quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { id, direction } = body;

    if (!id || !direction) {
      return NextResponse.json({ success: false, message: 'กรุณาระบุ id และ direction' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);

    const currentReply = await QuickReply.findById(id);
    if (!currentReply) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อความตอบกลับ' }, { status: 404 });
    }

    // ✅ hasChannelAccess จะตรวจสอบ active status แล้ว
    const hasAccess = await hasChannelAccess(userId, currentReply.channel_id);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'คุณไม่มีสิทธิ์แก้ไข หรือ Channel ถูกปิดใช้งานแล้ว' }, { status: 403 });
    }

    let adjacentReply;
    if (direction === 'up') {
      adjacentReply = await QuickReply.findOne({
        channel_id: currentReply.channel_id,
        is_active: true,
        sort_order: { $lt: currentReply.sort_order }
      }).sort({ sort_order: -1 });
    } else {
      adjacentReply = await QuickReply.findOne({
        channel_id: currentReply.channel_id,
        is_active: true,
        sort_order: { $gt: currentReply.sort_order }
      }).sort({ sort_order: 1 });
    }

    if (!adjacentReply) {
      return NextResponse.json({ 
        success: false, 
        message: direction === 'up' ? 'อยู่บนสุดแล้ว' : 'อยู่ล่างสุดแล้ว' 
      }, { status: 400 });
    }

    const tempOrder = currentReply.sort_order;
    currentReply.sort_order = adjacentReply.sort_order;
    adjacentReply.sort_order = tempOrder;

    await currentReply.save();
    await adjacentReply.save();

    return NextResponse.json({
      success: true,
      message: 'สลับลำดับสำเร็จ'
    });
  } catch (error) {
    console.error('Reorder quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}