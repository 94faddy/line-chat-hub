import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AdminPermission, User, LineChannel } from '@/models';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET - ดึงข้อมูล invite (ก่อน accept)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    
    const { token } = await params;

    const permission = await AdminPermission.findOne({
      invite_token: token,
      status: 'pending',
    })
    .populate('owner_id', 'name email')
    .populate('channel_id', 'channel_name')
    .lean();

    if (!permission) {
      return NextResponse.json({ success: false, message: 'ลิงก์เชิญไม่ถูกต้องหรือถูกใช้แล้ว' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        owner: {
          name: (permission.owner_id as any)?.name,
          email: (permission.owner_id as any)?.email,
        },
        channel: permission.channel_id ? {
          name: (permission.channel_id as any)?.channel_name,
        } : { name: 'ทุก Channel' },
        permissions: {
          can_reply: permission.can_reply,
          can_view_all: permission.can_view_all,
          can_broadcast: permission.can_broadcast,
          can_manage_tags: permission.can_manage_tags,
        },
      },
    });
  } catch (error) {
    console.error('Get invite error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - ยอมรับคำเชิญ
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    
    const { token } = await params;
    
    const authToken = request.cookies.get('auth_token')?.value;
    if (!authToken) {
      return NextResponse.json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อน' }, { status: 401 });
    }

    const payload = verifyToken(authToken);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const permission = await AdminPermission.findOne({
      invite_token: token,
      status: 'pending',
    });

    if (!permission) {
      return NextResponse.json({ success: false, message: 'ลิงก์เชิญไม่ถูกต้องหรือถูกใช้แล้ว' }, { status: 404 });
    }

    // ห้ามเชิญตัวเอง
    if (permission.owner_id.toString() === payload.userId) {
      return NextResponse.json({ success: false, message: 'ไม่สามารถเชิญตัวเองได้' }, { status: 400 });
    }

    // ตรวจสอบว่ามี permission อยู่แล้วหรือไม่
    const existing = await AdminPermission.findOne({
      owner_id: permission.owner_id,
      admin_id: payload.userId,
      channel_id: permission.channel_id,
      status: 'active',
    });

    if (existing) {
      // ลบ pending invite
      await AdminPermission.findByIdAndDelete(permission._id);
      return NextResponse.json({ success: false, message: 'คุณเป็นทีมงานอยู่แล้ว' }, { status: 400 });
    }

    // อัพเดท permission
    permission.admin_id = payload.userId as any;
    permission.status = 'active';
    permission.invite_token = undefined;
    await permission.save();

    return NextResponse.json({ success: true, message: 'เข้าร่วมทีมสำเร็จ' });
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ยกเลิก/ปฏิเสธคำเชิญ (owner หรือ invitee)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    
    const { token } = await params;
    
    const authToken = request.cookies.get('auth_token')?.value;
    if (!authToken) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(authToken);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const permission = await AdminPermission.findOne({ invite_token: token });

    if (!permission) {
      return NextResponse.json({ success: false, message: 'ไม่พบลิงก์เชิญ' }, { status: 404 });
    }

    // Owner สามารถยกเลิกได้
    if (permission.owner_id.toString() !== payload.userId) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์ยกเลิก' }, { status: 403 });
    }

    await AdminPermission.findByIdAndDelete(permission._id);

    return NextResponse.json({ success: true, message: 'ยกเลิกคำเชิญสำเร็จ' });
  } catch (error) {
    console.error('Cancel invite error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
