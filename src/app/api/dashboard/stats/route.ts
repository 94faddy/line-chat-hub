import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { LineChannel, LineUser, Conversation, Message, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';

// Helper: ดึง channel IDs ที่ user มีสิทธิ์เข้าถึง
async function getAccessibleChannelIds(userId: string): Promise<string[]> {
  // Channel ที่เป็นเจ้าของ
  const ownedChannels = await LineChannel.find({ user_id: userId }).select('_id').lean();
  const channelIds = ownedChannels.map((c: any) => c._id.toString());
  
  // Channel ที่เป็น admin
  const permissions = await AdminPermission.find({
    admin_id: userId,
    status: 'active',
  }).populate('channel_id', '_id').lean();
  
  permissions.forEach((p: any) => {
    if (p.channel_id && !channelIds.includes(p.channel_id._id.toString())) {
      channelIds.push(p.channel_id._id.toString());
    }
  });
  
  return channelIds;
}

// GET - ดึงสถิติสำหรับ Dashboard
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
    const period = searchParams.get('period') || '7d'; // 7d, 30d, 90d

    // ดึง channel IDs ที่มีสิทธิ์เข้าถึง
    const channelIds = await getAccessibleChannelIds(payload.userId);

    if (channelIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          total_channels: 0,
          total_users: 0,
          total_conversations: 0,
          unread_conversations: 0,
          messages_today: 0,
          messages_this_period: 0,
          new_users_this_period: 0,
        },
      });
    }

    // Filter channel ถ้าระบุ
    const targetChannelIds = channelId && channelIds.includes(channelId) 
      ? [channelId] 
      : channelIds;

    // คำนวณ date range
    const now = new Date();
    let periodStart: Date;
    
    switch (period) {
      case '30d':
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default: // 7d
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // สถิติพื้นฐาน
    const [
      totalChannels,
      totalUsers,
      totalConversations,
      unreadConversations,
      messagesToday,
      messagesThisPeriod,
      newUsersThisPeriod,
    ] = await Promise.all([
      // จำนวน channel
      LineChannel.countDocuments({ _id: { $in: targetChannelIds } }),
      
      // จำนวน users
      LineUser.countDocuments({ channel_id: { $in: targetChannelIds } }),
      
      // จำนวน conversations
      Conversation.countDocuments({ channel_id: { $in: targetChannelIds } }),
      
      // จำนวน unread conversations
      Conversation.countDocuments({ 
        channel_id: { $in: targetChannelIds },
        status: 'unread',
      }),
      
      // ข้อความวันนี้
      Message.countDocuments({
        channel_id: { $in: targetChannelIds },
        created_at: { $gte: todayStart },
      }),
      
      // ข้อความในช่วงเวลา
      Message.countDocuments({
        channel_id: { $in: targetChannelIds },
        created_at: { $gte: periodStart },
      }),
      
      // users ใหม่ในช่วงเวลา
      LineUser.countDocuments({
        channel_id: { $in: targetChannelIds },
        created_at: { $gte: periodStart },
      }),
    ]);

    // ข้อมูลกราฟ: ข้อความรายวัน
    const messagesByDay = await Message.aggregate([
      {
        $match: {
          channel_id: { $in: targetChannelIds.map((id: string) => new (require('mongoose').Types.ObjectId)(id)) },
          created_at: { $gte: periodStart },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$created_at' },
          },
          incoming: {
            $sum: { $cond: [{ $eq: ['$direction', 'incoming'] }, 1, 0] },
          },
          outgoing: {
            $sum: { $cond: [{ $eq: ['$direction', 'outgoing'] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top channels by messages
    const topChannels = await Message.aggregate([
      {
        $match: {
          channel_id: { $in: targetChannelIds.map((id: string) => new (require('mongoose').Types.ObjectId)(id)) },
          created_at: { $gte: periodStart },
        },
      },
      {
        $group: {
          _id: '$channel_id',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'linechannels',
          localField: '_id',
          foreignField: '_id',
          as: 'channel',
        },
      },
      { $unwind: '$channel' },
      {
        $project: {
          channel_id: '$_id',
          channel_name: '$channel.channel_name',
          count: 1,
        },
      },
    ]);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_channels: totalChannels,
          total_users: totalUsers,
          total_conversations: totalConversations,
          unread_conversations: unreadConversations,
          messages_today: messagesToday,
          messages_this_period: messagesThisPeriod,
          new_users_this_period: newUsersThisPeriod,
        },
        charts: {
          messages_by_day: messagesByDay,
          top_channels: topChannels,
        },
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
