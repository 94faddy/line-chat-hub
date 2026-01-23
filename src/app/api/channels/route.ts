// src/app/api/channels/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import { getChannelInfo } from '@/lib/line';
import mongoose from 'mongoose';

// GET - ดึงรายการ Channels ทั้งหมด (owner + admin permissions)
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

    // ✅ ตรวจสอบว่าต้องการดู channels ประเภทไหน
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // 'active', 'inactive', 'deleted', 'all'

    // กำหนด status filter
    let queryStatusFilter: any = { status: 'active' }; // default
    if (statusFilter === 'inactive') {
      queryStatusFilter = { status: 'inactive' };
    } else if (statusFilter === 'deleted') {
      queryStatusFilter = { status: 'deleted' };
    } else if (statusFilter === 'all') {
      queryStatusFilter = {}; // ไม่ filter status
    } else if (statusFilter === 'not_active') {
      // ดูทั้ง inactive และ deleted
      queryStatusFilter = { status: { $in: ['inactive', 'deleted'] } };
    }

    // ดึง channels ที่ user เป็น owner (✅ เพิ่ม status filter)
    const ownedChannels = await LineChannel.find({ 
      user_id: userId,
      ...queryStatusFilter
    }).lean();

    // ดึง admin permissions
    const adminPerms = await AdminPermission.find({
      admin_id: userId,
      status: 'active'
    });

    // สร้าง map เก็บ permissions ของแต่ละ channel
    const channelPermissionsMap = new Map<string, any>();

    // รวบรวม channel IDs ที่มีสิทธิ์เข้าถึงผ่าน admin permissions
    let additionalChannelIds: mongoose.Types.ObjectId[] = [];
    let ownerIdsForAllChannels: mongoose.Types.ObjectId[] = [];

    for (const perm of adminPerms) {
      if (perm.channel_id) {
        additionalChannelIds.push(perm.channel_id);
        // เก็บ permissions ของ channel นี้
        channelPermissionsMap.set(perm.channel_id.toString(), perm.permissions || {});
      } else if (perm.owner_id) {
        ownerIdsForAllChannels.push(perm.owner_id);
        // เก็บ permissions แบบ all channels ไว้ก่อน (จะ apply ทีหลัง)
        channelPermissionsMap.set(`owner_${perm.owner_id.toString()}`, perm.permissions || {});
      }
    }

    // ดึง specific channels (✅ เพิ่ม status filter)
    let additionalChannels: any[] = [];
    if (additionalChannelIds.length > 0) {
      additionalChannels = await LineChannel.find({
        _id: { $in: additionalChannelIds },
        ...queryStatusFilter
      }).lean();
    }

    // ดึง channels ของ owners ที่มีสิทธิ์ทั้งหมด (✅ เพิ่ม status filter)
    let ownerChannels: any[] = [];
    if (ownerIdsForAllChannels.length > 0) {
      ownerChannels = await LineChannel.find({
        user_id: { $in: ownerIdsForAllChannels },
        ...queryStatusFilter
      }).lean();
    }

    // รวม channels ทั้งหมด (ไม่ซ้ำกัน)
    const channelMap = new Map();
    
    // Owner channels - มีสิทธิ์ทุกอย่าง
    ownedChannels.forEach(ch => {
      channelMap.set(ch._id.toString(), { 
        ...ch, 
        isOwner: true,
        permissions: {
          can_reply: true,
          can_view_all: true,
          can_broadcast: true,
          can_manage_tags: true,
          can_manage_channel: true
        }
      });
    });
    
    // Additional channels (specific channel permissions)
    additionalChannels.forEach(ch => {
      if (!channelMap.has(ch._id.toString())) {
        const perms = channelPermissionsMap.get(ch._id.toString()) || {};
        channelMap.set(ch._id.toString(), { 
          ...ch, 
          isOwner: false,
          permissions: {
            can_reply: perms.can_reply ?? true,
            can_view_all: perms.can_view_all ?? false,
            can_broadcast: perms.can_broadcast ?? false,
            can_manage_tags: perms.can_manage_tags ?? false,
            can_manage_channel: perms.can_manage_channel ?? false
          }
        });
      }
    });
    
    // Owner's all channels (permissions from "all channels" invite)
    ownerChannels.forEach(ch => {
      if (!channelMap.has(ch._id.toString())) {
        const perms = channelPermissionsMap.get(`owner_${ch.user_id.toString()}`) || {};
        channelMap.set(ch._id.toString(), { 
          ...ch, 
          isOwner: false,
          permissions: {
            can_reply: perms.can_reply ?? true,
            can_view_all: perms.can_view_all ?? false,
            can_broadcast: perms.can_broadcast ?? false,
            can_manage_tags: perms.can_manage_tags ?? false,
            can_manage_channel: perms.can_manage_channel ?? false
          }
        });
      }
    });

    const channels = Array.from(channelMap.values()).map(ch => ({
      id: ch._id,
      channel_name: ch.channel_name,
      channel_id: ch.channel_id,
      webhook_url: ch.webhook_url,
      basic_id: ch.basic_id,
      picture_url: ch.picture_url,
      status: ch.status,
      followers_count: ch.followers_count,
      isOwner: ch.isOwner,
      permissions: ch.permissions,
      created_at: ch.created_at,
      deleted_at: ch.deleted_at // ✅ เพิ่มเวลาที่ลบ (ถ้ามี)
    }));

    return NextResponse.json({ success: true, data: channels });
  } catch (error) {
    console.error('Get channels error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - สร้าง Channel ใหม่
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
    const { channel_name, channel_id, channel_secret, channel_access_token } = body;

    if (!channel_name || !channel_id || !channel_secret || !channel_access_token) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ✅ ตรวจสอบว่า channel_id ซ้ำหรือไม่ (รวมทุก status)
    const existingChannel = await LineChannel.findOne({ channel_id, user_id: userId });
    
    if (existingChannel) {
      // ✅ ถ้า channel เดิมเป็น 'deleted' → restore + update credentials อัตโนมัติ
      if (existingChannel.status === 'deleted') {
        // ดึงข้อมูล Channel จาก LINE API
        let channelInfo: any = {};
        try {
          channelInfo = await getChannelInfo(channel_access_token);
        } catch (e) {
          console.error('Get channel info error:', e);
        }

        // Restore channel + update credentials
        await LineChannel.findByIdAndUpdate(existingChannel._id, {
          status: 'active',
          channel_name,
          channel_secret,
          channel_access_token,
          basic_id: channelInfo.basicId || existingChannel.basic_id,
          picture_url: channelInfo.pictureUrl || existingChannel.picture_url,
          $unset: { deleted_at: 1 }
        });

        return NextResponse.json({
          success: true,
          message: 'กู้คืน Channel สำเร็จ พร้อมข้อมูลเดิมทั้งหมด',
          data: {
            id: existingChannel._id,
            webhook_url: existingChannel.webhook_url,
            restored: true
          }
        });
      }
      
      // ✅ ถ้า channel เดิมเป็น 'inactive' → ถามว่าจะ restore หรือไม่
      if (existingChannel.status === 'inactive') {
        return NextResponse.json({ 
          success: false, 
          message: 'Channel ID นี้ถูกปิดใช้งานอยู่ คุณต้องการเปิดใช้งานใหม่หรือไม่?',
          canRestore: true,
          existingChannelId: existingChannel._id,
          existingChannelName: existingChannel.channel_name,
          existingStatus: 'inactive'
        }, { status: 409 }); // Conflict
      }
      
      // ✅ ถ้า channel active อยู่แล้ว → error
      return NextResponse.json({ success: false, message: 'Channel ID นี้มีอยู่แล้วและใช้งานอยู่' }, { status: 400 });
    }

    // ดึงข้อมูล Channel จาก LINE API
    let channelInfo: any = {};
    try {
      channelInfo = await getChannelInfo(channel_access_token);
    } catch (e) {
      console.error('Get channel info error:', e);
    }

    // สร้าง Webhook URL - ใช้ NEXT_PUBLIC_APIWEBHOOK สำหรับ subdomain webhook
    const apiWebhookBase = process.env.NEXT_PUBLIC_APIWEBHOOK || process.env.NEXT_PUBLIC_APP_URL;
    const webhookUrl = `${apiWebhookBase}/api/webhook/${channel_id}`;

    // สร้าง Channel ใหม่
    const newChannel = new LineChannel({
      user_id: userId,
      channel_name,
      channel_id,
      channel_secret,
      channel_access_token,
      webhook_url: webhookUrl,
      basic_id: channelInfo.basicId || null,
      picture_url: channelInfo.pictureUrl || null,
      status: 'active'
    });

    await newChannel.save();

    return NextResponse.json({
      success: true,
      message: 'สร้าง Channel สำเร็จ',
      data: {
        id: newChannel._id,
        webhook_url: webhookUrl
      }
    });
  } catch (error) {
    console.error('Create channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}