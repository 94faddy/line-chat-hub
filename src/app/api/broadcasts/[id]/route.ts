import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Broadcast, LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper: ตรวจสอบสิทธิ์เข้าถึง broadcast
async function checkBroadcastAccess(broadcastId: string, userId: string): Promise<boolean> {
  const broadcast = await Broadcast.findById(broadcastId).populate('channel_id', 'user_id');
  if (!broadcast) return false;
  
  const channel = broadcast.channel_id as any;
  if (!channel) return false;
  
  // Owner check
  if (channel.user_id.toString() === userId) {
    return true;
  }
  
  // Admin with broadcast permission
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

// GET - ดึงข้อมูล Broadcast
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
    const hasAccess = await checkBroadcastAccess(id, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const broadcast = await Broadcast.findById(id)
      .populate('channel_id', 'channel_name')
      .populate('created_by', 'name')
      .populate('target_tags', 'name color')
      .lean();

    if (!broadcast) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Broadcast' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...broadcast,
        id: broadcast._id,
        channel_name: (broadcast.channel_id as any)?.channel_name,
        created_by_name: (broadcast.created_by as any)?.name,
      },
    });
  } catch (error) {
    console.error('Get broadcast error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดท Broadcast (เฉพาะ draft/scheduled)
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

    // ตรวจสอบสิทธิ์
    const hasAccess = await checkBroadcastAccess(id, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์แก้ไข' }, { status: 403 });
    }

    const broadcast = await Broadcast.findById(id);
    if (!broadcast) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Broadcast' }, { status: 404 });
    }

    // ตรวจสอบสถานะ
    if (!['draft', 'scheduled'].includes(broadcast.status)) {
      return NextResponse.json({ success: false, message: 'ไม่สามารถแก้ไข Broadcast ที่ส่งแล้ว' }, { status: 400 });
    }

    const updateData: any = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.message_type !== undefined) updateData.message_type = body.message_type;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.flex_content !== undefined) updateData.flex_content = body.flex_content;
    if (body.media_url !== undefined) updateData.media_url = body.media_url;
    if (body.target_type !== undefined) updateData.target_type = body.target_type;
    if (body.target_tags !== undefined) updateData.target_tags = body.target_tags;
    if (body.scheduled_at !== undefined) {
      updateData.scheduled_at = body.scheduled_at ? new Date(body.scheduled_at) : null;
      updateData.status = body.scheduled_at ? 'scheduled' : 'draft';
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่มีข้อมูลที่จะอัพเดท' }, { status: 400 });
    }

    await Broadcast.findByIdAndUpdate(id, updateData);

    return NextResponse.json({ success: true, message: 'อัพเดทสำเร็จ' });
  } catch (error) {
    console.error('Update broadcast error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบ Broadcast (เฉพาะ draft/scheduled)
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

    // ตรวจสอบสิทธิ์
    const hasAccess = await checkBroadcastAccess(id, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์ลบ' }, { status: 403 });
    }

    const broadcast = await Broadcast.findById(id);
    if (!broadcast) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Broadcast' }, { status: 404 });
    }

    // ตรวจสอบสถานะ (ถ้าส่งแล้วให้แค่ cancel)
    if (['sending', 'sent'].includes(broadcast.status)) {
      return NextResponse.json({ success: false, message: 'ไม่สามารถลบ Broadcast ที่ส่งแล้ว' }, { status: 400 });
    }

    await Broadcast.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'ลบสำเร็จ' });
  } catch (error) {
    console.error('Delete broadcast error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
