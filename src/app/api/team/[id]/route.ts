import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - ดึงข้อมูล permission ของทีมงาน
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

    const permission = await AdminPermission.findOne({
      _id: id,
      owner_id: payload.userId,
    })
    .populate('admin_id', 'name email avatar')
    .populate('channel_id', 'channel_name')
    .lean();

    if (!permission) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อมูล' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: permission._id,
        admin: permission.admin_id ? {
          id: (permission.admin_id as any)._id,
          name: (permission.admin_id as any).name,
          email: (permission.admin_id as any).email,
          avatar: (permission.admin_id as any).avatar,
        } : null,
        channel: permission.channel_id ? {
          id: (permission.channel_id as any)._id,
          name: (permission.channel_id as any).channel_name,
        } : { id: null, name: 'ทุก Channel' },
        permissions: {
          can_reply: permission.can_reply,
          can_view_all: permission.can_view_all,
          can_broadcast: permission.can_broadcast,
          can_manage_tags: permission.can_manage_tags,
        },
        status: permission.status,
      },
    });
  } catch (error) {
    console.error('Get team member error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดท permissions ของทีมงาน
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

    const permission = await AdminPermission.findOne({
      _id: id,
      owner_id: payload.userId,
    });

    if (!permission) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อมูลหรือไม่มีสิทธิ์' }, { status: 404 });
    }

    const updateData: any = {};

    if (body.can_reply !== undefined) updateData.can_reply = body.can_reply;
    if (body.can_view_all !== undefined) updateData.can_view_all = body.can_view_all;
    if (body.can_broadcast !== undefined) updateData.can_broadcast = body.can_broadcast;
    if (body.can_manage_tags !== undefined) updateData.can_manage_tags = body.can_manage_tags;
    if (body.status !== undefined && ['active', 'inactive'].includes(body.status)) {
      updateData.status = body.status;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่มีข้อมูลที่จะอัพเดท' }, { status: 400 });
    }

    await AdminPermission.findByIdAndUpdate(id, updateData);

    return NextResponse.json({ success: true, message: 'อัพเดทสำเร็จ' });
  } catch (error) {
    console.error('Update team member error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบทีมงาน (เฉพาะ owner)
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

    const result = await AdminPermission.deleteOne({
      _id: id,
      owner_id: payload.userId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อมูลหรือไม่มีสิทธิ์' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'ลบทีมงานสำเร็จ' });
  } catch (error) {
    console.error('Delete team member error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
