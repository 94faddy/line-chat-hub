import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, LineChannel, LineUser, Conversation, Message, AdminPermission } from '@/models';
import { verifyTokenFromRequest } from '@/lib/auth';
import mongoose from 'mongoose';

// GET - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const user = verifyTokenFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d'; // 7d, 30d, 90d, all

    // Calculate date range
    let startDate: Date | null = null;
    const now = new Date();
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = null;
    }

    // Get user's channels (owned + admin access)
    const ownedChannels = await LineChannel.find({ user_id: user.id }).select('_id');
    const adminPermissions = await AdminPermission.find({ 
      admin_id: user.id,
      $or: [
        { channel_id: { $ne: null } },
        { owner_id: { $ne: null } }
      ]
    });

    // Get all accessible channel IDs
    const channelIds: mongoose.Types.ObjectId[] = ownedChannels.map(c => c._id);
    
    for (const perm of adminPermissions) {
      if (perm.channel_id) {
        channelIds.push(perm.channel_id);
      } else if (perm.owner_id) {
        // Get all channels owned by this owner
        const ownerChannels = await LineChannel.find({ user_id: perm.owner_id }).select('_id');
        channelIds.push(...ownerChannels.map(c => c._id));
      }
    }

    // Remove duplicates
    const uniqueChannelIds = [...new Set(channelIds.map(id => id.toString()))];

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.created_at = { $gte: startDate };
    }

    // Get statistics
    const [
      totalChannels,
      totalUsers,
      totalConversations,
      activeConversations,
      totalMessages,
      messagesInPeriod,
      newUsersInPeriod,
      messagesByDay
    ] = await Promise.all([
      // Total channels count
      uniqueChannelIds.length,
      
      // Total LINE users
      LineUser.countDocuments({ 
        channel_id: { $in: uniqueChannelIds } 
      }),
      
      // Total conversations
      Conversation.countDocuments({ 
        channel_id: { $in: uniqueChannelIds } 
      }),
      
      // Active conversations
      Conversation.countDocuments({ 
        channel_id: { $in: uniqueChannelIds },
        status: 'active'
      }),
      
      // Total messages
      Message.countDocuments({ 
        channel_id: { $in: uniqueChannelIds } 
      }),
      
      // Messages in period
      startDate ? Message.countDocuments({ 
        channel_id: { $in: uniqueChannelIds },
        created_at: { $gte: startDate }
      }) : Message.countDocuments({ channel_id: { $in: uniqueChannelIds } }),
      
      // New users in period
      startDate ? LineUser.countDocuments({ 
        channel_id: { $in: uniqueChannelIds },
        created_at: { $gte: startDate }
      }) : LineUser.countDocuments({ channel_id: { $in: uniqueChannelIds } }),
      
      // Messages by day for chart
      Message.aggregate([
        {
          $match: {
            channel_id: { $in: uniqueChannelIds.map(id => new mongoose.Types.ObjectId(id)) },
            ...(startDate && { created_at: { $gte: startDate } })
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$created_at' }
            },
            count: { $sum: 1 },
            incoming: {
              $sum: { $cond: [{ $eq: ['$sender_type', 'user'] }, 1, 0] }
            },
            outgoing: {
              $sum: { $cond: [{ $eq: ['$sender_type', 'admin'] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Get top channels by messages
    const topChannels = await Message.aggregate([
      {
        $match: {
          channel_id: { $in: uniqueChannelIds.map(id => new mongoose.Types.ObjectId(id)) },
          ...(startDate && { created_at: { $gte: startDate } })
        }
      },
      {
        $group: {
          _id: '$channel_id',
          message_count: { $sum: 1 }
        }
      },
      { $sort: { message_count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'linechannels',
          localField: '_id',
          foreignField: '_id',
          as: 'channel'
        }
      },
      { $unwind: '$channel' }
    ]);

    // Get recent conversations
    const recentConversations = await Conversation.find({
      channel_id: { $in: uniqueChannelIds }
    })
      .sort({ last_message_at: -1 })
      .limit(5)
      .populate('line_user_id', 'display_name picture_url')
      .populate('channel_id', 'name')
      .lean();

    return NextResponse.json({
      overview: {
        total_channels: totalChannels,
        total_users: totalUsers,
        total_conversations: totalConversations,
        active_conversations: activeConversations,
        total_messages: totalMessages,
        messages_in_period: messagesInPeriod,
        new_users_in_period: newUsersInPeriod
      },
      charts: {
        messages_by_day: messagesByDay.map(item => ({
          date: item._id,
          total: item.count,
          incoming: item.incoming,
          outgoing: item.outgoing
        }))
      },
      top_channels: topChannels.map(item => ({
        id: item._id.toString(),
        name: item.channel.name,
        message_count: item.message_count
      })),
      recent_conversations: recentConversations.map(conv => ({
        id: conv._id.toString(),
        user_name: (conv.line_user_id as any)?.display_name || 'Unknown',
        user_picture: (conv.line_user_id as any)?.picture_url,
        channel_name: (conv.channel_id as any)?.name,
        last_message: conv.last_message_preview,
        last_message_at: conv.last_message_at,
        status: conv.status
      })),
      period
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
