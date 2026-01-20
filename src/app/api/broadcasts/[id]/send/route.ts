import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Broadcast, LineChannel, LineUser, Conversation, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper: ส่งข้อความ LINE
async function sendLineMessage(channelAccessToken: string, userId: string, message: any): Promise<boolean> {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [message],
      }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Send LINE message error:', error);
    return false;
  }
}

// Helper: ตรวจสอบสิทธิ์
async function checkBroadcastAccess(broadcastId: string, userId: string): Promise<boolean> {
  const broadcast = await Broadcast.findById(broadcastId).populate('channel_id', 'user_id');
  if (!broadcast) return false;
  
  const channel = broadcast.channel_id as any;
  if (!channel) return false;
  
  if (channel.user_id.toString() === userId) {
    return true;
  }
  
  const adminPermission = await AdminPermission.findOne({
    admin_id: userId,
    status: 'active',
    can_broadcast: true,
    $or: [
      { channel_id: broadcast.channel_id },
      { owner_id: channel.user_id, channel_id: null },
    ],
  });
  
  return !!adminPermission;
}

// POST - ส่ง Broadcast
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    // ตรวจสอบสิทธิ์
    const hasAccess = await checkBroadcastAccess(id, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์ส่ง' }, { status: 403 });
    }

    const broadcast = await Broadcast.findById(id).populate('channel_id');
    if (!broadcast) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Broadcast' }, { status: 404 });
    }

    // ตรวจสอบสถานะ
    if (!['draft', 'scheduled'].includes(broadcast.status)) {
      return NextResponse.json({ success: false, message: 'Broadcast นี้ส่งแล้วหรือถูกยกเลิก' }, { status: 400 });
    }

    const channel = broadcast.channel_id as any;
    if (!channel || !channel.channel_access_token) {
      return NextResponse.json({ success: false, message: 'Channel ไม่มี Access Token' }, { status: 400 });
    }

    // อัพเดทสถานะเป็น sending
    broadcast.status = 'sending';
    broadcast.sent_at = new Date();
    await broadcast.save();

    // ดึง LINE users ตาม target type
    let userQuery: any = {
      channel_id: broadcast.channel_id._id,
      is_blocked: false,
    };

    if (broadcast.target_type === 'tagged' && broadcast.target_tags && broadcast.target_tags.length > 0) {
      // ดึง conversations ที่มี tags เหล่านี้
      const conversations = await Conversation.find({
        channel_id: broadcast.channel_id._id,
        tags: { $in: broadcast.target_tags },
      }).select('line_user_id').lean();
      
      const lineUserIds = conversations.map((c: any) => c.line_user_id);
      userQuery._id = { $in: lineUserIds };
    }

    const lineUsers = await LineUser.find(userQuery).select('line_user_id').lean();

    // สร้าง LINE message object
    let lineMessage: any;
    
    switch (broadcast.message_type) {
      case 'text':
        lineMessage = { type: 'text', text: broadcast.content };
        break;
      case 'image':
        lineMessage = {
          type: 'image',
          originalContentUrl: broadcast.media_url,
          previewImageUrl: broadcast.media_url,
        };
        break;
      case 'video':
        lineMessage = {
          type: 'video',
          originalContentUrl: broadcast.media_url,
          previewImageUrl: broadcast.media_url?.replace(/\.[^/.]+$/, '.jpg') || broadcast.media_url,
        };
        break;
      case 'flex':
        lineMessage = {
          type: 'flex',
          altText: broadcast.content,
          contents: typeof broadcast.flex_content === 'string' 
            ? JSON.parse(broadcast.flex_content) 
            : broadcast.flex_content,
        };
        break;
      default:
        lineMessage = { type: 'text', text: broadcast.content };
    }

    // ส่งข้อความทีละคน (สามารถปรับเป็น batch ได้)
    let successCount = 0;
    let failCount = 0;

    for (const user of lineUsers) {
      const success = await sendLineMessage(
        channel.channel_access_token,
        (user as any).line_user_id,
        lineMessage
      );
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Rate limit: 1000 requests per minute for LINE API
      // หน่วงเล็กน้อยเพื่อไม่ให้โดน rate limit
      if ((successCount + failCount) % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // อัพเดทสถานะและสถิติ
    broadcast.status = failCount === lineUsers.length && lineUsers.length > 0 ? 'failed' : 'sent';
    broadcast.total_recipients = lineUsers.length;
    broadcast.success_count = successCount;
    broadcast.fail_count = failCount;
    await broadcast.save();

    return NextResponse.json({
      success: true,
      message: 'ส่ง Broadcast สำเร็จ',
      data: {
        total: lineUsers.length,
        success: successCount,
        failed: failCount,
      },
    });
  } catch (error) {
    console.error('Send broadcast error:', error);
    
    // อัพเดทสถานะเป็น failed
    try {
      const { id } = await params;
      await Broadcast.findByIdAndUpdate(id, { status: 'failed' });
    } catch {}
    
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
