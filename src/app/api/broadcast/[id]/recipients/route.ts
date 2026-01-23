// src/app/api/broadcast/[id]/recipients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Broadcast, LineChannel, AdminPermission, BroadcastRecipient } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - ดึงรายชื่อผู้รับ Broadcast
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
    const userId = new mongoose.Types.ObjectId(payload.userId);

    // Query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status'); // 'sent', 'failed', or null for all
    const search = searchParams.get('search') || '';

    // ดึง Broadcast
    const broadcast = await Broadcast.findById(id);
    if (!broadcast) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Broadcast' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์เข้าถึง Channel
    const channel = await LineChannel.findById(broadcast.channel_id);
    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    const isOwner = channel.user_id.equals(userId);
    if (!isOwner) {
      const adminPerm = await AdminPermission.findOne({
        admin_id: userId,
        owner_id: channel.user_id,
        status: 'active',
        $or: [
          { channel_id: channel._id },
          { channel_id: null }
        ]
      });
      
      if (!adminPerm || !adminPerm.permissions?.can_broadcast) {
        return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
      }
    }

    // สร้าง query
    const query: any = { broadcast_id: new mongoose.Types.ObjectId(id) };
    
    // Filter by status
    if (status && ['sent', 'failed'].includes(status)) {
      query.status = status;
    }
    
    // Search by display_name or line_user_id
    if (search) {
      query.$or = [
        { display_name: { $regex: search, $options: 'i' } },
        { line_user_id: { $regex: search, $options: 'i' } }
      ];
    }

    // นับจำนวนทั้งหมด
    const total = await BroadcastRecipient.countDocuments(query);
    
    // ดึงข้อมูล recipients พร้อม pagination
    const skip = (page - 1) * limit;
    const recipients = await BroadcastRecipient.find(query)
      .sort({ sent_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // นับสถิติ
    const stats = await BroadcastRecipient.aggregate([
      { $match: { broadcast_id: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statsMap: Record<string, number> = {
      sent: 0,
      failed: 0,
      pending: 0
    };
    stats.forEach(s => {
      statsMap[s._id] = s.count;
    });

    return NextResponse.json({
      success: true,
      data: {
        recipients: recipients.map(r => ({
          id: r._id,
          line_user_id: r.line_user_id,
          display_name: r.display_name || 'ไม่ทราบชื่อ',
          picture_url: r.picture_url,
          status: r.status,
          error_message: r.error_message,
          sent_at: r.sent_at
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: statsMap
      }
    });

  } catch (error) {
    console.error('Get broadcast recipients error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}