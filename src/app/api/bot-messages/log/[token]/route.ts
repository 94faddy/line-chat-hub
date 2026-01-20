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

    // ⭐ ถ้าไม่ได้ส่ง channel_id มา ให้หาจาก user's channels
    let channel;
    if (channel_id) {
      channel = await LineChannel.findById(channel_id);
    } else {
      // หา channel แรกของ user หรือหาจาก line_user_id ที่เคยคุยด้วย
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

    // Find or create LINE user
    let lineUser = await LineUser.findOne({ 
      line_user_id: line_user_id,
      channel_id: channel._id
    });

    if (!lineUser) {
      // ⭐ พยายามดึงข้อมูลจาก LINE API ก่อน
      let displayName = body.user_name || 'Unknown';
      let pictureUrl = null;
      
      try {
        const profile = await getUserProfile(channel.channel_access_token, line_user_id);
        if (profile && profile.displayName) {
          displayName = profile.displayName;
          pictureUrl = profile.pictureUrl || null;
          console.log('👤 [Bot Log] Got profile from LINE:', displayName);
        }
      } catch (e) {
        console.log('⚠️ [Bot Log] Could not get LINE profile, using fallback name');
      }
      
      lineUser = await LineUser.create({
        line_user_id: line_user_id,
        channel_id: channel._id,
        display_name: displayName,
        picture_url: pictureUrl
      });
      console.log('👤 [Bot Log] Created new LINE user:', lineUser._id, displayName);
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