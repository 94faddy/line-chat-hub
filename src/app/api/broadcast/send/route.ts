// src/app/api/broadcast/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Broadcast, LineUser, LineChannel, AdminPermission, BroadcastRecipient } from '@/models';
import { verifyToken } from '@/lib/auth';
import { broadcastMessage, multicastMessage } from '@/lib/line';
import mongoose from 'mongoose';

// Delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Interface สำหรับ message
interface MessageInput {
  type: 'text' | 'image' | 'flex';
  content: string;
  altText?: string;
}

// Interface สำหรับ user ที่จะส่ง
interface UserToSend {
  _id: mongoose.Types.ObjectId;
  line_user_id: string;
  display_name?: string;
  picture_url?: string;
}

// แปลง Flex JSON จาก LINE Simulator format เป็น LINE API format
const convertFlexMessage = (content: string, altText: string = 'Flex Message'): any => {
  try {
    const parsed = JSON.parse(content);
    
    // ถ้าเป็นรูปแบบจาก LINE Simulator (type: bubble หรือ carousel)
    if (parsed.type === 'bubble' || parsed.type === 'carousel') {
      return {
        type: 'flex',
        altText: altText,
        contents: parsed
      };
    }
    
    // ถ้าเป็นรูปแบบเต็ม (type: flex)
    if (parsed.type === 'flex') {
      return {
        type: 'flex',
        altText: parsed.altText || altText,
        contents: parsed.contents
      };
    }
    
    throw new Error('Invalid Flex JSON format');
  } catch (e: any) {
    throw new Error(`Flex JSON error: ${e.message}`);
  }
};

// แปลง message input เป็น LINE message object
const convertToLineMessage = (msg: MessageInput): any => {
  if (msg.type === 'text') {
    return {
      type: 'text',
      text: msg.content
    };
  }
  
  if (msg.type === 'image') {
    return {
      type: 'image',
      originalContentUrl: msg.content,
      previewImageUrl: msg.content
    };
  }
  
  if (msg.type === 'flex') {
    return convertFlexMessage(msg.content, msg.altText);
  }
  
  throw new Error(`Unknown message type: ${msg.type}`);
};

// POST - ส่ง Broadcast
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { 
      channel_id, 
      broadcast_type, // 'official' | 'push'
      messages,       // Array of { type, content, altText? }
      // Legacy support - single message
      message_type,
      content,
      limit = 0,
      delay_ms = 100
    } = body;

    if (!channel_id) {
      return NextResponse.json({ success: false, message: 'กรุณาเลือก Channel' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);
    const channelObjectId = new mongoose.Types.ObjectId(channel_id);

    // ✅ ตรวจสอบสิทธิ์เข้าถึง channel (เฉพาะ active)
    const channel = await LineChannel.findOne({
      _id: channelObjectId,
      status: 'active'
    });
    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel หรือ Channel ถูกปิดใช้งานแล้ว' }, { status: 404 });
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
        return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์ Broadcast' }, { status: 403 });
      }
    }

    // สร้าง LINE message objects
    let lineMessages: any[] = [];
    
    // ถ้าส่งมาแบบ multi-messages (array)
    if (messages && Array.isArray(messages) && messages.length > 0) {
      if (messages.length > 5) {
        return NextResponse.json({ 
          success: false, 
          message: 'ส่งได้สูงสุด 5 ข้อความต่อครั้ง' 
        }, { status: 400 });
      }
      
      for (const msg of messages) {
        try {
          const lineMsg = convertToLineMessage(msg);
          lineMessages.push(lineMsg);
        } catch (e: any) {
          return NextResponse.json({ 
            success: false, 
            message: e.message 
          }, { status: 400 });
        }
      }
    } 
    // Legacy support - single message
    else if (content && message_type) {
      try {
        const lineMsg = convertToLineMessage({ 
          type: message_type, 
          content: content 
        });
        lineMessages.push(lineMsg);
      } catch (e: any) {
        return NextResponse.json({ 
          success: false, 
          message: e.message 
        }, { status: 400 });
      }
    }
    else {
      return NextResponse.json({ 
        success: false, 
        message: 'กรุณาระบุข้อความที่ต้องการส่ง' 
      }, { status: 400 });
    }

    let sentCount = 0;
    let failedCount = 0;
    let targetCount = 0;
    
    // ✅ เก็บข้อมูลผู้รับสำหรับบันทึก
    const recipientsToSave: any[] = [];

    // กำหนด message_type สำหรับ record
    let recordMessageType = 'text';
    if (lineMessages.length > 1) {
      recordMessageType = 'multi';
    } else if (lineMessages[0]?.type === 'flex') {
      recordMessageType = 'flex';
    } else if (lineMessages[0]?.type === 'image') {
      recordMessageType = 'image';
    }

    // สร้าง content summary
    let contentSummary = '';
    if (lineMessages.length === 1) {
      if (lineMessages[0].type === 'text') {
        contentSummary = lineMessages[0].text?.substring(0, 500) || '';
      } else if (lineMessages[0].type === 'flex') {
        contentSummary = `[Flex Message] ${lineMessages[0].altText || ''}`;
      } else if (lineMessages[0].type === 'image') {
        contentSummary = '[รูปภาพ]';
      }
    } else {
      const types = lineMessages.map(m => {
        if (m.type === 'text') return 'ข้อความ';
        if (m.type === 'flex') return 'Flex';
        if (m.type === 'image') return 'รูปภาพ';
        return m.type;
      });
      contentSummary = `[${lineMessages.length} ข้อความ: ${types.join(', ')}]`;
    }

    // ✅ สร้าง Broadcast record ก่อน (เพื่อเอา _id ไปใช้)
    const newBroadcast = new Broadcast({
      channel_id: channelObjectId,
      broadcast_type: broadcast_type,
      message_type: recordMessageType,
      content: contentSummary,
      target_type: 'all',
      target_count: 0, // จะอัพเดทภายหลัง
      sent_count: 0,
      failed_count: 0,
      status: 'sending',
      sent_at: new Date(),
      created_by: userId
    });
    await newBroadcast.save();

    const broadcastId = newBroadcast._id;

    if (broadcast_type === 'official') {
      // ==========================================
      // แบบที่ 1: Broadcast ปกติ (ใช้โควต้า LINE OA)
      // ==========================================
      try {
        await broadcastMessage(channel.channel_access_token, lineMessages);
        
        // ✅ ดึง users ทั้งหมดพร้อมข้อมูลโปรไฟล์
        // ✅ Filter เฉพาะ LINE User ID ที่ถูกต้อง
        const users = await LineUser.find({
          channel_id: channelObjectId,
          source_type: 'user',
          follow_status: { $nin: ['unfollowed', 'blocked'] },
          line_user_id: { $regex: /^U[a-f0-9]{32}$/i } // ✅ เฉพาะ LINE User ID ที่ถูกต้อง
        }).select('_id line_user_id display_name picture_url').lean() as UserToSend[];
        
        targetCount = users.length;
        sentCount = targetCount;
        
        // ✅ บันทึกผู้รับทั้งหมด (Official broadcast ถือว่าส่งสำเร็จทุกคน)
        const sentAt = new Date();
        for (const user of users) {
          recipientsToSave.push({
            broadcast_id: broadcastId,
            channel_id: channelObjectId,
            line_user_id: user.line_user_id,
            user_id: user._id,
            display_name: user.display_name || null,
            picture_url: user.picture_url || null,
            status: 'sent',
            sent_at: sentAt
          });
        }
        
      } catch (error: any) {
        console.error('Official broadcast error:', error);
        
        // อัพเดท broadcast status เป็น failed
        await Broadcast.findByIdAndUpdate(broadcastId, {
          status: 'failed',
          failed_count: 1
        });
        
        return NextResponse.json({ 
          success: false, 
          message: error.message || 'ส่ง Broadcast ไม่สำเร็จ' 
        }, { status: 500 });
      }
      
    } else {
      // ==========================================
      // แบบที่ 2: Push Broadcast (ส่งทีละ batch - ฟรี!)
      // ==========================================
      
      // ✅ ดึง users ทั้งหมดพร้อมข้อมูลโปรไฟล์
      // ✅ Filter เฉพาะ LINE User ID ที่ถูกต้อง (ขึ้นต้นด้วย U + 32 hex chars)
      let query = LineUser.find({
        channel_id: channelObjectId,
        source_type: 'user',
        follow_status: { $nin: ['unfollowed', 'blocked'] },
        line_user_id: { $regex: /^U[a-f0-9]{32}$/i } // ✅ เฉพาะ LINE User ID ที่ถูกต้อง
      })
        .select('_id line_user_id display_name picture_url')
        .sort({ created_at: 1 });
      
      if (limit > 0) {
        query = query.limit(limit);
      }
      
      const users = await query.lean() as UserToSend[];
      targetCount = users.length;

      if (targetCount === 0) {
        // ลบ broadcast record ที่สร้างไว้
        await Broadcast.findByIdAndDelete(broadcastId);
        
        return NextResponse.json({ 
          success: false, 
          message: 'ไม่มีผู้ใช้ที่สามารถส่งข้อความได้' 
        }, { status: 400 });
      }

      // สร้าง map สำหรับ lookup user info
      const userMap = new Map<string, UserToSend>();
      users.forEach(u => userMap.set(u.line_user_id, u));

      const userIds = users.map(u => u.line_user_id);

      // แบ่งเป็น batch ละ 500 คน (LINE API limit)
      const BATCH_SIZE = 500;
      const batches: string[][] = [];
      
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        batches.push(userIds.slice(i, i + BATCH_SIZE));
      }

      console.log(`📤 [Push Broadcast] Starting: ${targetCount} users in ${batches.length} batches, ${lineMessages.length} messages`);

      // ส่งทีละ batch
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const sentAt = new Date();
        
        try {
          await multicastMessage(channel.channel_access_token, batch, lineMessages);
          sentCount += batch.length;
          console.log(`✅ [Push Broadcast] Batch ${i + 1}/${batches.length}: ${batch.length} users sent`);
          
          // ✅ บันทึกผู้รับที่ส่งสำเร็จ
          for (const lineUserId of batch) {
            const userInfo = userMap.get(lineUserId);
            recipientsToSave.push({
              broadcast_id: broadcastId,
              channel_id: channelObjectId,
              line_user_id: lineUserId,
              user_id: userInfo?._id || null,
              display_name: userInfo?.display_name || null,
              picture_url: userInfo?.picture_url || null,
              status: 'sent',
              sent_at: sentAt
            });
          }
          
        } catch (error: any) {
          console.error(`❌ [Push Broadcast] Batch ${i + 1} failed:`, error.message);
          failedCount += batch.length;
          
          // ✅ บันทึกผู้รับที่ส่งไม่สำเร็จ
          for (const lineUserId of batch) {
            const userInfo = userMap.get(lineUserId);
            recipientsToSave.push({
              broadcast_id: broadcastId,
              channel_id: channelObjectId,
              line_user_id: lineUserId,
              user_id: userInfo?._id || null,
              display_name: userInfo?.display_name || null,
              picture_url: userInfo?.picture_url || null,
              status: 'failed',
              error_message: error.message || 'Unknown error',
              sent_at: sentAt
            });
          }
        }

        // Delay ระหว่าง batch (ป้องกัน rate limit)
        if (i < batches.length - 1) {
          await delay(delay_ms);
        }
      }

      console.log(`📤 [Push Broadcast] Completed: ${sentCount} sent, ${failedCount} failed`);
    }

    // ✅ บันทึก recipients ทั้งหมด (bulk insert)
    if (recipientsToSave.length > 0) {
      try {
        await BroadcastRecipient.insertMany(recipientsToSave, { ordered: false });
        console.log(`📝 [Broadcast] Saved ${recipientsToSave.length} recipients`);
      } catch (error: any) {
        console.error('Save recipients error:', error.message);
        // ไม่ fail ทั้งหมด ถ้าบันทึก recipients ไม่สำเร็จ
      }
    }

    // ✅ อัพเดท Broadcast record
    await Broadcast.findByIdAndUpdate(broadcastId, {
      target_count: targetCount,
      sent_count: sentCount,
      failed_count: failedCount,
      status: failedCount === 0 ? 'completed' : (sentCount > 0 ? 'completed' : 'failed')
    });

    return NextResponse.json({
      success: true,
      message: 'ส่ง Broadcast สำเร็จ',
      data: {
        id: broadcastId,
        target_count: targetCount,
        sent_count: sentCount,
        failed_count: failedCount,
        message_count: lineMessages.length
      }
    });

  } catch (error: any) {
    console.error('Send broadcast error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message || 'เกิดข้อผิดพลาด' 
    }, { status: 500 });
  }
}