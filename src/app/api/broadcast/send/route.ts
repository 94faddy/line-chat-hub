import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Broadcast, LineUser, LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import { broadcastMessage, multicastMessage } from '@/lib/line';
import mongoose from 'mongoose';

// Delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
      message_type,   // 'text' | 'image' | 'flex'
      content,
      limit = 0,      // จำนวนที่ต้องการส่ง (0 = ทั้งหมด)
      delay_ms = 100  // delay ระหว่าง batch (default 100ms)
    } = body;

    if (!channel_id || !content) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ตรวจสอบสิทธิ์เข้าถึง channel
    const channel = await LineChannel.findById(channel_id);
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
        return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์ Broadcast' }, { status: 403 });
      }
    }

    // สร้าง LINE message object
    let lineMessage: any;
    
    if (message_type === 'flex') {
      // Parse Flex JSON
      try {
        const flexData = JSON.parse(content);
        lineMessage = {
          type: 'flex',
          altText: flexData.altText || 'Flex Message',
          contents: flexData.contents
        };
      } catch (e) {
        return NextResponse.json({ success: false, message: 'Flex JSON ไม่ถูกต้อง' }, { status: 400 });
      }
    } else if (message_type === 'image') {
      lineMessage = {
        type: 'image',
        originalContentUrl: content,
        previewImageUrl: content
      };
    } else {
      lineMessage = {
        type: 'text',
        text: content
      };
    }

    let sentCount = 0;
    let failedCount = 0;
    let targetCount = 0;

    if (broadcast_type === 'official') {
      // ==========================================
      // แบบที่ 1: Broadcast ปกติ (ใช้โควต้า LINE OA)
      // ==========================================
      try {
        await broadcastMessage(channel.channel_access_token, lineMessage);
        
        // นับ followers (ประมาณ)
        targetCount = await LineUser.countDocuments({
          channel_id: new mongoose.Types.ObjectId(channel_id),
          source_type: 'user',
          follow_status: { $nin: ['unfollowed', 'blocked'] }
        });
        sentCount = targetCount;
        
      } catch (error: any) {
        console.error('Official broadcast error:', error);
        failedCount = 1;
        
        return NextResponse.json({ 
          success: false, 
          message: error.message || 'ส่ง Broadcast ไม่สำเร็จ' 
        }, { status: 500 });
      }
      
    } else {
      // ==========================================
      // แบบที่ 2: Push Broadcast (ส่งทีละ batch - ฟรี!)
      // ==========================================
      
      // ดึง user IDs ทั้งหมดที่สามารถส่งได้
      // เรียงตาม created_at (เก่าสุดก่อน)
      let query = LineUser.find({
        channel_id: new mongoose.Types.ObjectId(channel_id),
        source_type: 'user',
        follow_status: { $nin: ['unfollowed', 'blocked'] }
      })
        .select('line_user_id')
        .sort({ created_at: 1 }); // เรียงจากเก่าสุด (ทักมาก่อน)
      
      // ถ้ามี limit ให้จำกัดจำนวน
      if (limit > 0) {
        query = query.limit(limit);
      }
      
      const users = await query.lean();
      const userIds = users.map(u => u.line_user_id);
      targetCount = userIds.length;

      if (targetCount === 0) {
        return NextResponse.json({ 
          success: false, 
          message: 'ไม่มีผู้ใช้ที่สามารถส่งข้อความได้' 
        }, { status: 400 });
      }

      // แบ่งเป็น batch ละ 500 คน (LINE API limit)
      const BATCH_SIZE = 500;
      const batches: string[][] = [];
      
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        batches.push(userIds.slice(i, i + BATCH_SIZE));
      }

      console.log(`📤 [Push Broadcast] Starting: ${targetCount} users in ${batches.length} batches`);

      // ส่งทีละ batch
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        try {
          await multicastMessage(channel.channel_access_token, batch, lineMessage);
          sentCount += batch.length;
          console.log(`✅ [Push Broadcast] Batch ${i + 1}/${batches.length}: ${batch.length} users sent`);
        } catch (error: any) {
          console.error(`❌ [Push Broadcast] Batch ${i + 1} failed:`, error.message);
          failedCount += batch.length;
        }

        // Delay ระหว่าง batch (ป้องกัน rate limit)
        if (i < batches.length - 1) {
          await delay(delay_ms);
        }
      }

      console.log(`📤 [Push Broadcast] Completed: ${sentCount} sent, ${failedCount} failed`);
    }

    // บันทึก Broadcast record
    const newBroadcast = new Broadcast({
      channel_id: new mongoose.Types.ObjectId(channel_id),
      broadcast_type: broadcast_type,
      message_type: message_type || 'text',
      content: message_type === 'flex' ? '[Flex Message]' : content.substring(0, 500),
      target_type: 'all',
      target_count: targetCount,
      sent_count: sentCount,
      failed_count: failedCount,
      status: failedCount === 0 ? 'completed' : (sentCount > 0 ? 'completed' : 'failed'),
      sent_at: new Date(),
      created_by: userId
    });

    await newBroadcast.save();

    return NextResponse.json({
      success: true,
      message: 'ส่ง Broadcast สำเร็จ',
      data: {
        id: newBroadcast._id,
        target_count: targetCount,
        sent_count: sentCount,
        failed_count: failedCount
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