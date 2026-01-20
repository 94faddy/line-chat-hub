import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, LineChannel, LineUser, Conversation, Message } from '@/models';
import { notifyNewMessage, notifyConversationUpdate } from '@/lib/notifier';
import { getUserProfile } from '@/lib/line';

interface RouteParams {
  params: Promise<{ token: string }>;
}

// POST - Log message sent externally (via bot token)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();

    const { token } = await params;

    // Find user by bot token
    const user = await User.findOne({ bot_api_token: token });
    if (!user) {
      return NextResponse.json({ error: 'Invalid API token' }, { status: 401 });
    }

    const body = await request.json();
    let { 
      channel_id, 
      line_user_id, 
      message_type = 'text',
      content,
      flex_content,
      media_url,
      direction = 'outgoing'
    } = body;

    console.log('📥 [Bot Log] Received:', { channel_id, line_user_id, message_type, direction });

    // Validate line_user_id
    if (!line_user_id) {
      return NextResponse.json({ 
        error: 'line_user_id is required' 
      }, { status: 400 });
    }

    if (!content && !flex_content) {
      return NextResponse.json({ 
        error: 'content or flex_content is required' 
      }, { status: 400 });
    }

    // ⭐ หา channel
    let channel;
    if (channel_id) {
      channel = await LineChannel.findById(channel_id);
    } else {
      // หาจาก line_user_id ที่มีอยู่แล้ว
      const existingLineUser = await LineUser.findOne({ line_user_id: line_user_id })
        .populate('channel_id');
      
      if (existingLineUser && existingLineUser.channel_id) {
        channel = existingLineUser.channel_id;
        channel_id = channel._id.toString();
        console.log('📍 [Bot Log] Found channel from existing line user:', channel_id);
      } else {
        // หา channel แรกของ user
        channel = await LineChannel.findOne({ user_id: user._id, status: 'active' });
        if (channel) {
          channel_id = channel._id.toString();
          console.log('📍 [Bot Log] Using first channel of user:', channel_id);
        }
      }
    }

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    // Verify user owns this channel
    if (channel.user_id.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // ⭐ Find existing LINE user for this channel
    let lineUser = await LineUser.findOne({ 
      line_user_id: line_user_id,
      channel_id: channel._id
    });

    if (!lineUser) {
      // ⭐ ต้องดึง profile จาก LINE API ก่อนสร้าง user ใหม่
      let profile: any = null;
      let followStatus: 'following' | 'unfollowed' | 'blocked' | 'unknown' = 'unknown';
      
      try {
        profile = await getUserProfile(channel.channel_access_token, line_user_id);
        if (profile && profile.displayName) {
          followStatus = 'following';
          console.log('👤 [Bot Log] Got profile from LINE:', profile.displayName);
        }
      } catch (e: any) {
        // ถ้า 404 แสดงว่า user unfollow หรือไม่เคยเพิ่มเพื่อน
        if (e.response?.status === 404 || e.message?.includes('404')) {
          followStatus = 'unfollowed';
          console.log('⚠️ [Bot Log] User has unfollowed or never followed');
        } else {
          console.log('⚠️ [Bot Log] Could not get LINE profile:', e.message);
        }
      }

      // ⭐ ถ้าดึง profile ไม่ได้ ไม่สร้าง user/conversation ใหม่
      if (!profile || !profile.displayName) {
        console.log('❌ [Bot Log] Cannot create conversation - user profile not available');
        return NextResponse.json({ 
          error: 'Cannot log message - user may have unfollowed or blocked the bot',
          follow_status: followStatus
        }, { status: 400 });
      }
      
      // สร้าง LINE user ใหม่
      lineUser = await LineUser.create({
        line_user_id: line_user_id,
        channel_id: channel._id,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl || null,
        status_message: profile.statusMessage || null,
        follow_status: followStatus
      });
      console.log('👤 [Bot Log] Created new LINE user:', lineUser._id, profile.displayName);
    } else {
      // ⭐ ถ้า user มีอยู่แล้ว ตรวจสอบว่า display_name ยังเป็น null/Unknown หรือไม่
      if (!lineUser.display_name || lineUser.display_name === 'Unknown') {
        // ลองดึง profile ใหม่
        try {
          const profile = await getUserProfile(channel.channel_access_token, line_user_id);
          if (profile && profile.displayName) {
            lineUser.display_name = profile.displayName;
            lineUser.picture_url = profile.pictureUrl || lineUser.picture_url;
            lineUser.follow_status = 'following';
            await lineUser.save();
            console.log('👤 [Bot Log] Updated user profile:', profile.displayName);
          }
        } catch (e: any) {
          if (e.response?.status === 404 || e.message?.includes('404')) {
            lineUser.follow_status = 'unfollowed';
            await lineUser.save();
          }
          console.log('⚠️ [Bot Log] Could not refresh profile');
        }
      }

      // ⭐ ถ้า follow_status เป็น unfollowed หรือ display_name ยังเป็น null ไม่ควรสร้าง message
      if (lineUser.follow_status === 'unfollowed' || lineUser.follow_status === 'blocked') {
        return NextResponse.json({ 
          error: 'Cannot log message - user has unfollowed or blocked',
          follow_status: lineUser.follow_status
        }, { status: 400 });
      }
      
      if (!lineUser.display_name || lineUser.display_name === 'Unknown') {
        return NextResponse.json({ 
          error: 'Cannot log message - user profile not available',
          follow_status: lineUser.follow_status
        }, { status: 400 });
      }
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({
      channel_id: channel._id,
      line_user_id: lineUser._id
    });

    if (!conversation) {
      conversation = await Conversation.create({
        channel_id: channel._id,
        line_user_id: lineUser._id,
        status: 'read',
        unread_count: 0
      });
      console.log('💬 [Bot Log] Created new conversation:', conversation._id);
    }

    // Create message record
    const savedMessage = await Message.create({
      conversation_id: conversation._id,
      channel_id: channel._id,
      line_user_id: lineUser._id,
      direction: direction,
      message_type: message_type,
      content: content || (flex_content ? '[Flex Message]' : ''),
      flex_content: flex_content || null,
      media_url: media_url || null,
      sent_by: direction === 'outgoing' ? user._id : null,
      source_type: 'bot_reply',
      is_read: direction === 'outgoing',
    });

    console.log('💾 [Bot Log] Message saved:', savedMessage._id);

    // Update conversation
    const preview = message_type === 'text' 
      ? (content || '').substring(0, 100) 
      : `[${message_type}]`;

    await Conversation.findByIdAndUpdate(conversation._id, {
      last_message_at: new Date(),
      last_message_preview: preview,
    });

    // ⭐ ส่ง realtime notification
    try {
      console.log('📤 [Bot Log] Sending notification...');
      
      await notifyNewMessage(channel._id.toString(), conversation._id.toString(), {
        id: savedMessage._id,
        direction: direction,
        message_type: message_type,
        content: content,
        flex_content: flex_content,
        media_url: media_url,
        source_type: 'bot_reply',
        created_at: savedMessage.created_at
      });

      await notifyConversationUpdate(channel._id.toString(), {
        id: conversation._id,
        status: conversation.status,
        last_message_preview: preview,
        last_message_at: new Date(),
        unread_count: conversation.unread_count,
      });

      console.log('✅ [Bot Log] Notification sent!');
    } catch (e) {
      console.error('❌ [Bot Log] Notify error:', e);
    }

    return NextResponse.json({
      success: true,
      message_id: savedMessage._id.toString(),
      conversation_id: conversation._id.toString(),
      channel_id: channel._id.toString()
    });
  } catch (error) {
    console.error('❌ [Bot Log] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Get message history for a conversation
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();

    const { token } = await params;

    // Find user by bot token
    const user = await User.findOne({ bot_api_token: token });
    if (!user) {
      return NextResponse.json({ error: 'Invalid API token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversation_id');
    const channelId = searchParams.get('channel_id');
    const lineUserId = searchParams.get('line_user_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before');

    let conversation;

    if (conversationId) {
      conversation = await Conversation.findById(conversationId)
        .populate('channel_id');
    } else if (channelId && lineUserId) {
      const lineUser = await LineUser.findOne({
        channel_id: channelId,
        line_user_id: lineUserId
      });
      
      if (lineUser) {
        conversation = await Conversation.findOne({
          channel_id: channelId,
          line_user_id: lineUser._id
        }).populate('channel_id');
      }
    } else if (lineUserId) {
      // หาจาก line_user_id อย่างเดียว
      const lineUser = await LineUser.findOne({ line_user_id: lineUserId });
      if (lineUser) {
        conversation = await Conversation.findOne({
          line_user_id: lineUser._id
        }).populate('channel_id');
      }
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verify access
    const channel = conversation.channel_id as any;
    if (channel.user_id.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Build query
    const query: any = { conversation_id: conversation._id };
    if (before) {
      query.created_at = { $lt: new Date(before) };
    }

    // Get messages
    const messages = await Message.find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      conversation_id: conversation._id.toString(),
      messages: messages.reverse().map(msg => ({
        id: msg._id.toString(),
        direction: msg.direction,
        message_type: msg.message_type,
        content: msg.content,
        flex_content: msg.flex_content,
        media_url: msg.media_url,
        created_at: msg.created_at
      }))
    });
  } catch (error) {
    console.error('Get bot messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}