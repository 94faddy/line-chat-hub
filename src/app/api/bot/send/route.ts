import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, LineChannel, LineUser, Conversation, Message } from '@/models';
import { sendLinePush } from '@/lib/line';
import { notifyNewMessage, notifyConversationUpdate } from '@/lib/notifier';
import mongoose from 'mongoose';

// POST - Send message via Bot API Token
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Get API token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Find user by bot token
    const user = await User.findOne({ bot_api_token: token });
    if (!user) {
      return NextResponse.json({ error: 'Invalid API token' }, { status: 401 });
    }

    const body = await request.json();
    const { channel_id, line_user_id, message, message_type = 'text' } = body;

    // Validate required fields
    if (!channel_id) {
      return NextResponse.json({ error: 'channel_id is required' }, { status: 400 });
    }

    if (!line_user_id) {
      return NextResponse.json({ error: 'line_user_id is required' }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Find channel
    const channel = await LineChannel.findById(channel_id);
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    // Verify user owns this channel
    if (channel.user_id.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Access denied to this channel' }, { status: 403 });
    }

    // Find or create LINE user
    let lineUser = await LineUser.findOne({ 
      line_user_id: line_user_id,
      channel_id: channel._id
    });

    if (!lineUser) {
      // Create new LINE user
      lineUser = await LineUser.create({
        line_user_id: line_user_id,
        channel_id: channel._id,
        display_name: 'Unknown User'
      });
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
        status: 'active'
      });
    }

    // Build LINE message object
    let lineMessage: any;
    switch (message_type) {
      case 'text':
        lineMessage = { type: 'text', text: message };
        break;
      case 'image':
        lineMessage = { 
          type: 'image', 
          originalContentUrl: message,
          previewImageUrl: message 
        };
        break;
      case 'sticker':
        const [packageId, stickerId] = message.split(':');
        lineMessage = { 
          type: 'sticker', 
          packageId: packageId,
          stickerId: stickerId
        };
        break;
      case 'flex':
        lineMessage = {
          type: 'flex',
          altText: 'Flex Message',
          contents: typeof message === 'string' ? JSON.parse(message) : message
        };
        break;
      default:
        lineMessage = { type: 'text', text: message };
    }

    // Send message via LINE API
    try {
      await sendLinePush(
        channel.channel_access_token,
        line_user_id,
        [lineMessage]
      );
    } catch (lineError: any) {
      console.error('LINE API error:', lineError);
      return NextResponse.json({ 
        error: 'Failed to send message via LINE',
        details: lineError.message 
      }, { status: 500 });
    }

    // Save message to database
    const savedMessage = await Message.create({
      conversation_id: conversation._id,
      channel_id: channel._id,
      line_user_id: lineUser._id,
      direction: 'outgoing',
      message_type: message_type,
      content: message,
      flex_content: message_type === 'flex' ? (typeof message === 'string' ? JSON.parse(message) : message) : null,
      sent_by: user._id,
      source_type: 'bot_reply',
      is_read: true,
    });

    // Update conversation
    await Conversation.findByIdAndUpdate(conversation._id, {
      last_message_at: new Date(),
      last_message_preview: message_type === 'text' ? message.substring(0, 100) : `[${message_type}]`
    });

    // ส่ง realtime notification
    try {
      await notifyNewMessage(channel._id.toString(), conversation._id.toString(), {
        id: savedMessage._id,
        direction: 'outgoing',
        message_type: message_type,
        content: message,
        source_type: 'bot_api',
        created_at: savedMessage.created_at
      });

      await notifyConversationUpdate(channel._id.toString(), {
        id: conversation._id,
        last_message_preview: message_type === 'text' ? message.substring(0, 100) : `[${message_type}]`,
        last_message_at: new Date(),
      });
    } catch (e) {
      console.error('Notify error:', e);
    }

    return NextResponse.json({
      success: true,
      message_id: savedMessage._id.toString(),
      conversation_id: conversation._id.toString()
    });
  } catch (error) {
    console.error('Bot send error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}