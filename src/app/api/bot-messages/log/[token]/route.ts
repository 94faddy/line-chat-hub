/**
 * ============================================================
 * 📁 PATH: src/app/api/bot-messages/log/[token]/route.ts
 * 📝 DESCRIPTION: Log ข้อความที่ Bot ส่งออก (outgoing messages)
 * 🔑 PARAM: token (Bot API Token เช่น "bot_d808e6c4...")
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, LineChannel, LineUser, Conversation, Message } from '@/models';
import { notifyNewMessage, notifyConversationUpdate } from '@/lib/notifier';
import { getUserProfile, getGroupMemberProfile } from '@/lib/line';

interface RouteParams {
  params: Promise<{ token: string }>;
}

// ✅ Helper function สำหรับ delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
      channel_id,          // MongoDB ObjectId (เดิม)
      line_channel_id,     // ✅ LINE Channel ID (เช่น "2007183189") - ใหม่!
      line_user_id,
      group_id,            // ✅ เพิ่มรองรับ group_id
      room_id,             // ✅ เพิ่มรองรับ room_id
      message_type = 'text',
      content,
      flex_content,
      media_url,
      direction = 'outgoing',
      original_timestamp   // ✅ timestamp จาก LINE event (milliseconds)
    } = body;

    // ✅ ระบุ target: ถ้ามี group_id/room_id ให้ส่งไปที่กลุ่ม ไม่ใช่ user
    const isGroupMessage = !!group_id || !!room_id;
    const targetId = group_id || room_id || line_user_id;

    console.log('📥 [Bot Log] Received:', { 
      channel_id, 
      line_channel_id,  // ✅ เพิ่ม log
      line_user_id, 
      group_id, 
      room_id,
      isGroupMessage,
      message_type, 
      direction,
      original_timestamp
    });

    // ✅ ถ้าไม่มี original_timestamp ให้รอ 1.5 วินาที เพื่อให้ webhook บันทึกก่อน
    if (!original_timestamp) {
      console.log('⏳ [Bot Log] No original_timestamp, waiting 1.5s for webhook to process first...');
      await delay(1500);
    }

    // Validate target
    if (!targetId) {
      return NextResponse.json({ 
        error: 'line_user_id, group_id, or room_id is required' 
      }, { status: 400 });
    }

    if (!content && !flex_content) {
      return NextResponse.json({ 
        error: 'content or flex_content is required' 
      }, { status: 400 });
    }

    // ⭐ หา channel - ต้องระบุให้ชัดเจน ไม่ใช้ fallback
    let channel;
    
    // วิธี 1: ใช้ channel_id (MongoDB ObjectId)
    if (channel_id) {
      channel = await LineChannel.findById(channel_id);
      if (channel) {
        console.log('📍 [Bot Log] Found channel by _id:', channel_id);
      }
    }
    
    // ✅ วิธี 1.5: ใช้ line_channel_id (LINE Channel ID เช่น "2007183189")
    if (!channel && line_channel_id) {
      channel = await LineChannel.findOne({ 
        channel_id: line_channel_id,
        user_id: user._id,
        status: 'active'
      });
      if (channel) {
        console.log('📍 [Bot Log] Found channel by line_channel_id:', line_channel_id, '- Channel:', channel.channel_name);
      }
    }
    
    // วิธี 2: หาจาก existing line user (user/group/room ที่เคยมีอยู่แล้ว)
    if (!channel) {
      const existingLineUser = await LineUser.findOne({ line_user_id: targetId })
        .populate('channel_id');
      
      if (existingLineUser && existingLineUser.channel_id) {
        channel = existingLineUser.channel_id as any;
        channel_id = channel._id.toString();
        console.log('📍 [Bot Log] Found channel from existing line user:', channel_id, '- Channel:', channel.channel_name);
      }
    }

    // ❌ ไม่ใช้ "channel แรกของ user" เป็น fallback อีกต่อไป
    // เพราะจะทำให้ข้อความไปผิด channel
    
    if (!channel) {
      console.log('⚠️ [Bot Log] Channel not found for target:', targetId, '(line_channel_id:', line_channel_id, ') - Skipping');
      return NextResponse.json({ 
        error: 'Channel not found - target user/group not registered in BevChat',
        target_id: targetId,
        line_channel_id: line_channel_id,
        hint: 'This target may belong to a LINE channel not connected to BevChat'
      }, { status: 404 });
    }

    // Verify user owns this channel
    if (channel.user_id.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('✅ [Bot Log] Processing for channel:', channel.channel_name, '(', channel.channel_id, ')');

    // ⭐ Find or create LINE user (group/room/user)
    let lineUser = await LineUser.findOne({ 
      line_user_id: targetId,
      channel_id: channel._id
    });

    if (!lineUser) {
      if (isGroupMessage) {
        // ✅ สร้าง entry สำหรับ group/room
        const sourceType = group_id ? 'group' : 'room';
        lineUser = await LineUser.create({
          line_user_id: targetId,
          channel_id: channel._id,
          display_name: `${sourceType === 'group' ? 'กลุ่ม' : 'ห้อง'} ${targetId.substring(0, 8)}...`,
          source_type: sourceType,
          group_id: group_id || undefined,
          room_id: room_id || undefined,
          follow_status: 'following'
        });
        console.log('👥 [Bot Log] Created new group/room entry:', lineUser._id);
      } else {
        // ⭐ ต้องดึง profile จาก LINE API ก่อนสร้าง user ใหม่
        let profile: any = null;
        let followStatus: 'following' | 'unfollowed' | 'blocked' | 'unknown' = 'unknown';
        let displayName = `User ${line_user_id.substring(0, 8)}...`; // ✅ Default display name
        let pictureUrl = null;
        
        try {
          profile = await getUserProfile(channel.channel_access_token, line_user_id);
          if (profile && profile.displayName) {
            followStatus = 'following';
            displayName = profile.displayName;
            pictureUrl = profile.pictureUrl || null;
            console.log('👤 [Bot Log] Got profile from LINE:', profile.displayName);
          }
        } catch (e: any) {
          if (e.response?.status === 404 || e.message?.includes('404') || e.message?.includes('Not found')) {
            followStatus = 'unknown'; // ✅ เปลี่ยนเป็น unknown แทน unfollowed สำหรับ Liff share
            console.log('⚠️ [Bot Log] User profile not available (may be Liff share) - using default name');
          } else {
            console.log('⚠️ [Bot Log] Could not get LINE profile:', e.message);
          }
        }

        // ✅ สร้าง user ได้แม้ดึง profile ไม่ได้ (สำหรับ Liff share)
        lineUser = await LineUser.create({
          line_user_id: line_user_id,
          channel_id: channel._id,
          display_name: displayName,
          picture_url: pictureUrl,
          status_message: profile?.statusMessage || null,
          source_type: 'user',
          follow_status: followStatus
        });
        console.log('👤 [Bot Log] Created new LINE user:', lineUser._id, displayName);
      }
    } else {
      // ⭐ ถ้า user มีอยู่แล้ว และไม่ใช่กลุ่ม ตรวจสอบ follow_status
      if (!isGroupMessage) {
        if (!lineUser.display_name || lineUser.display_name === 'Unknown') {
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

    // ✅ ดึงข้อความล่าสุดใน conversation เพื่อให้ bot response อยู่หลังเสมอ
    const lastMessage = await Message.findOne({ conversation_id: conversation._id })
      .sort({ created_at: -1 })
      .select('created_at')
      .lean();

    // ✅ คำนวณ timestamp สำหรับ bot message
    let botMessageTime: Date;
    
    if (original_timestamp) {
      // ถ้ามี original_timestamp จาก LINE event ให้ใช้ + 500ms
      botMessageTime = new Date(original_timestamp + 500);
      console.log('⏰ [Bot Log] Using original_timestamp + 500ms');
    } else if (lastMessage && lastMessage.created_at) {
      // ถ้าไม่มี original_timestamp แต่มีข้อความล่าสุด ให้ใช้ timestamp หลังนั้น + 500ms
      botMessageTime = new Date(new Date(lastMessage.created_at).getTime() + 500);
      console.log('⏰ [Bot Log] Using last message timestamp + 500ms');
    } else {
      // ถ้าไม่มีทั้งสองอย่าง ใช้เวลาปัจจุบัน
      botMessageTime = new Date();
      console.log('⏰ [Bot Log] Using current time');
    }

    console.log('⏰ [Bot Log] Bot message timestamp:', botMessageTime.toISOString());

    // Create message record - ✅ ไม่ใส่ sender_info สำหรับ bot
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
      created_at: botMessageTime, // ✅ ใช้ timestamp ที่อยู่หลังข้อความล่าสุด
      // ✅ ไม่ใส่ sender_info เพราะเป็น bot ส่ง
    });

    console.log('💾 [Bot Log] Message saved:', savedMessage._id, 'to conversation:', conversation._id);

    // ✅ สร้าง preview ตามประเภทข้อความ
    let preview = '';
    switch (message_type) {
      case 'text':
        preview = (content || '').substring(0, 100);
        break;
      case 'flex':
        preview = '[Flex Message]';
        break;
      case 'image':
        preview = '[รูปภาพ]';
        break;
      case 'video':
        preview = '[วิดีโอ]';
        break;
      case 'audio':
        preview = '[เสียง]';
        break;
      case 'sticker':
        preview = '[สติกเกอร์]';
        break;
      default:
        preview = `[${message_type}]`;
    }

    // ✅ Update conversation เฉพาะเมื่อ timestamp ใหม่กว่า
    await Conversation.findOneAndUpdate(
      { 
        _id: conversation._id,
        $or: [
          { last_message_at: { $lt: botMessageTime } },
          { last_message_at: null }
        ]
      },
      {
        last_message_at: botMessageTime,
        last_message_preview: preview,
      }
    );
    
    console.log('📝 [Bot Log] Conversation preview updated to:', preview);

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
        // ✅ ไม่ส่ง sender_info
        created_at: savedMessage.created_at
      });

      await notifyConversationUpdate(channel._id.toString(), {
        id: conversation._id,
        status: conversation.status,
        last_message_preview: preview,
        last_message_at: botMessageTime, // ✅ ใช้ botMessageTime
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
      channel_id: channel._id.toString(),
      target_type: isGroupMessage ? (group_id ? 'group' : 'room') : 'user'
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