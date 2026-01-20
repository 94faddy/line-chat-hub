import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { QuickReply, AdminPermission, LineChannel } from '@/models';
import { verifyToken } from '@/lib/auth';

// Helper: ดึง owner IDs ที่ user มีสิทธิ์เข้าถึง
async function getAccessibleOwnerIds(userId: string): Promise<string[]> {
  const ownerIds = [userId];
  
  const permissions = await AdminPermission.find({
    admin_id: userId,
    status: 'active',
  }).select('owner_id').lean();
  
  permissions.forEach((p: any) => {
    if (p.owner_id) {
      const ownerId = p.owner_id.toString();
      if (!ownerIds.includes(ownerId)) {
        ownerIds.push(ownerId);
      }
    }
  });
  
  return ownerIds;
}

// GET - ดึงรายการข้อความตอบกลับ (รวม owner + admin permissions)
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

    // ดึง owner IDs ที่มีสิทธิ์เข้าถึง
    const ownerIds = await getAccessibleOwnerIds(payload.userId);

    const query: any = {
      user_id: { $in: ownerIds },
      is_active: true,
    };

    // ดึงทั้งที่เป็น global (channel_id = null) และของ channel ที่ระบุ
    if (channelId) {
      query.$or = [
        { channel_id: null },
        { channel_id: channelId },
      ];
    }

    const replies = await QuickReply.find(query)
      .populate('channel_id', 'channel_name')
      .sort({ use_count: -1, created_at: -1 })
      .lean();

    const formattedReplies = replies.map((r: any) => ({
      ...r,
      id: r._id,
      channel_name: r.channel_id?.channel_name || null,
    }));

    return NextResponse.json({ success: true, data: formattedReplies });
  } catch (error) {
    console.error('Get quick replies error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - สร้างข้อความตอบกลับใหม่ (สร้างในชื่อตัวเอง)
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
    const { title, shortcut, message_type, content, flex_content, media_url, channel_id } = body;

    if (!title || !content) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกชื่อและข้อความ' }, { status: 400 });
    }

    // ถ้าระบุ channel_id ให้ตรวจสอบว่ามีสิทธิ์หรือไม่
    if (channel_id) {
      const ownerIds = await getAccessibleOwnerIds(payload.userId);
      
      const channel = await LineChannel.findOne({
        _id: channel_id,
        user_id: { $in: ownerIds },
      });
      
      if (!channel) {
        return NextResponse.json({ success: false, message: 'ไม่พบ Channel หรือไม่มีสิทธิ์' }, { status: 404 });
      }
    }

    const quickReply = new QuickReply({
      user_id: payload.userId,
      channel_id: channel_id || null,
      title,
      shortcut: shortcut || null,
      message_type: message_type || 'text',
      content,
      flex_content: flex_content || null,
      media_url: media_url || null,
    });

    await quickReply.save();

    return NextResponse.json({
      success: true,
      message: 'สร้างข้อความตอบกลับสำเร็จ',
      data: { id: quickReply._id },
    });
  } catch (error) {
    console.error('Create quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
