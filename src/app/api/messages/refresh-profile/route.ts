import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { LineUser, LineChannel, Conversation, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import { getUserProfile, getGroupSummary, getGroupMemberCount } from '@/lib/line';
import mongoose from 'mongoose';

// POST - Refresh LINE user profile
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
    const { line_user_id } = body;

    if (!line_user_id) {
      return NextResponse.json({ success: false, message: 'line_user_id is required' }, { status: 400 });
    }

    // หา LINE User
    const lineUser = await LineUser.findById(line_user_id);
    if (!lineUser) {
      return NextResponse.json({ success: false, message: 'ไม่พบผู้ใช้' }, { status: 404 });
    }

    // หา Channel
    const channel = await LineChannel.findById(lineUser.channel_id);
    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ตรวจสอบสิทธิ์
    const isOwner = channel.user_id.equals(userId);
    let hasPermission = isOwner;
    
    if (!isOwner) {
      const adminPerm = await AdminPermission.findOne({
        admin_id: userId,
        status: 'active',
        $or: [
          { channel_id: channel._id },
          { channel_id: null, owner_id: channel.user_id }
        ]
      });
      hasPermission = !!adminPerm;
    }

    if (!hasPermission) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์' }, { status: 403 });
    }

    // ✅ ตรวจสอบว่าเป็น group หรือ user
    if (lineUser.source_type === 'group' && lineUser.group_id) {
      // ดึงข้อมูลกลุ่มจาก LINE
      try {
        const groupInfo = await getGroupSummary(channel.channel_access_token, lineUser.group_id);
        const memberCount = await getGroupMemberCount(channel.channel_access_token, lineUser.group_id);
        
        lineUser.display_name = groupInfo.groupName || lineUser.display_name;
        lineUser.picture_url = groupInfo.pictureUrl || lineUser.picture_url;
        lineUser.member_count = memberCount + 1; // +1 รวม bot
        await lineUser.save();

        return NextResponse.json({ 
          success: true, 
          message: 'อัพเดทข้อมูลกลุ่มสำเร็จ',
          data: {
            display_name: lineUser.display_name,
            picture_url: lineUser.picture_url,
            member_count: lineUser.member_count
          }
        });
      } catch (error: any) {
        console.error('Refresh group info error:', error);
        return NextResponse.json({ 
          success: false, 
          message: 'ไม่สามารถดึงข้อมูลกลุ่มได้' 
        }, { status: 400 });
      }
    }

    // ดึง profile ใหม่จาก LINE (สำหรับ user ปกติ)
    try {
      const profile = await getUserProfile(channel.channel_access_token, lineUser.line_user_id);
      
      if (profile && profile.displayName) {
        lineUser.display_name = profile.displayName;
        lineUser.picture_url = profile.pictureUrl || lineUser.picture_url;
        lineUser.status_message = profile.statusMessage || lineUser.status_message;
        await lineUser.save();

        return NextResponse.json({ 
          success: true, 
          message: 'อัพเดทโปรไฟล์สำเร็จ',
          data: {
            display_name: lineUser.display_name,
            picture_url: lineUser.picture_url
          }
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          message: 'ไม่สามารถดึงโปรไฟล์ได้ (อาจยกเลิกการติดตามแล้ว)' 
        }, { status: 400 });
      }
    } catch (error: any) {
      console.error('Refresh profile error:', error);
      
      // ตรวจสอบ error type
      if (error.response?.status === 404) {
        return NextResponse.json({ 
          success: false, 
          message: 'ผู้ใช้ยกเลิกการติดตามแล้ว หรือไม่พบข้อมูล' 
        }, { status: 400 });
      }
      
      return NextResponse.json({ 
        success: false, 
        message: 'เกิดข้อผิดพลาดในการดึงโปรไฟล์' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Refresh profile error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}