import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { QuickReply, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

// Helper: ตรวจสอบสิทธิ์เข้าถึง quick reply
async function checkQuickReplyAccess(replyId: string, userId: string): Promise<{ hasAccess: boolean; isOwner: boolean }> {
  // เช็คว่าเป็น owner
  const reply = await QuickReply.findOne({
    _id: replyId,
    user_id: userId,
  });
  
  if (reply) {
    return { hasAccess: true, isOwner: true };
  }
  
  // เช็คว่าเป็น admin
  const ownerIds = await getAccessibleOwnerIds(userId);
  
  const adminReply = await QuickReply.findOne({
    _id: replyId,
    user_id: { $in: ownerIds },
  });
  
  if (adminReply) {
    return { hasAccess: true, isOwner: false };
  }
  
  return { hasAccess: false, isOwner: false };
}

// GET - ดึงข้อความตอบกลับ
export async function GET(request: NextRequest, { params }: RouteParams) {
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
    const { hasAccess } = await checkQuickReplyAccess(id, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const reply = await QuickReply.findById(id)
      .populate('channel_id', 'channel_name')
      .lean();

    if (!reply) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อความตอบกลับ' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...reply,
        id: reply._id,
        channel_name: (reply.channel_id as any)?.channel_name || null,
      },
    });
  } catch (error) {
    console.error('Get quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดทข้อความตอบกลับ (เฉพาะ owner)
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const body = await request.json();

    // ตรวจสอบว่าเป็น owner
    const { isOwner } = await checkQuickReplyAccess(id, payload.userId);
    if (!isOwner) {
      return NextResponse.json({ success: false, message: 'เฉพาะเจ้าของเท่านั้นที่แก้ไขได้' }, { status: 403 });
    }

    const updateData: any = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.shortcut !== undefined) updateData.shortcut = body.shortcut;
    if (body.message_type !== undefined) updateData.message_type = body.message_type;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.flex_content !== undefined) updateData.flex_content = body.flex_content;
    if (body.media_url !== undefined) updateData.media_url = body.media_url;
    if (body.channel_id !== undefined) updateData.channel_id = body.channel_id;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่มีข้อมูลที่จะอัพเดท' }, { status: 400 });
    }

    await QuickReply.findByIdAndUpdate(id, updateData);

    return NextResponse.json({ success: true, message: 'อัพเดทสำเร็จ' });
  } catch (error) {
    console.error('Update quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบข้อความตอบกลับ (เฉพาะ owner)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const result = await QuickReply.deleteOne({
      _id: id,
      user_id: payload.userId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อความตอบกลับหรือไม่มีสิทธิ์' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'ลบสำเร็จ' });
  } catch (error) {
    console.error('Delete quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - เพิ่ม use count (ทุกคนที่มีสิทธิ์ใช้ได้)
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
    const { hasAccess } = await checkQuickReplyAccess(id, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์' }, { status: 403 });
    }

    await QuickReply.findByIdAndUpdate(id, { $inc: { use_count: 1 } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update use count error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
