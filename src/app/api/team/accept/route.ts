import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: { token: string };
}

// GET - ดึงข้อมูล invite
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json({ success: false, message: 'Token is required' }, { status: 400 });
    }

    // ค้นหา invite
    const invites = await query(
      `SELECT ap.*, 
              u.name as owner_name, u.email as owner_email,
              lc.channel_name
       FROM admin_permissions ap
       LEFT JOIN users u ON ap.owner_id = u.id
       LEFT JOIN line_channels lc ON ap.channel_id = lc.id
       WHERE ap.invite_token = ? AND ap.status = 'pending'`,
      [token]
    );

    if (!Array.isArray(invites) || invites.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว' 
      }, { status: 404 });
    }

    const invite = invites[0] as any;

    // ตรวจสอบวันหมดอายุ
    if (invite.invite_expires_at) {
      const expiresAt = new Date(invite.invite_expires_at);
      if (new Date() > expiresAt) {
        return NextResponse.json({ 
          success: false, 
          message: 'ลิงก์เชิญหมดอายุแล้ว' 
        }, { status: 410 });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: invite.id,
        owner_name: invite.owner_name,
        owner_email: invite.owner_email,
        channel_name: invite.channel_name || 'ทุก Channel',
        permissions: invite.permissions,
        expires_at: invite.invite_expires_at
      }
    });
  } catch (error: any) {
    console.error('Get invite error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - Accept invite
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = params;
    
    // ต้อง login ก่อน
    const authToken = request.cookies.get('auth_token')?.value;
    if (!authToken) {
      return NextResponse.json({ 
        success: false, 
        message: 'กรุณาเข้าสู่ระบบก่อนรับคำเชิญ',
        require_login: true
      }, { status: 401 });
    }

    const payload = verifyToken(authToken);
    if (!payload) {
      return NextResponse.json({ 
        success: false, 
        message: 'Token ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่',
        require_login: true
      }, { status: 401 });
    }

    // ค้นหา invite
    const invites = await query(
      `SELECT ap.*, u.id as owner_user_id
       FROM admin_permissions ap
       LEFT JOIN users u ON ap.owner_id = u.id
       WHERE ap.invite_token = ? AND ap.status = 'pending'`,
      [token]
    );

    if (!Array.isArray(invites) || invites.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว' 
      }, { status: 404 });
    }

    const invite = invites[0] as any;

    // ตรวจสอบวันหมดอายุ
    if (invite.invite_expires_at) {
      const expiresAt = new Date(invite.invite_expires_at);
      if (new Date() > expiresAt) {
        return NextResponse.json({ 
          success: false, 
          message: 'ลิงก์เชิญหมดอายุแล้ว' 
        }, { status: 410 });
      }
    }

    // ตรวจสอบว่า user รับคำเชิญตัวเอง
    if (invite.owner_id === payload.userId) {
      return NextResponse.json({ 
        success: false, 
        message: 'ไม่สามารถรับคำเชิญตัวเองได้' 
      }, { status: 400 });
    }

    // ตรวจสอบว่า user นี้มี permission กับ owner นี้อยู่แล้วหรือไม่
    const existingPermission = await query(
      `SELECT id FROM admin_permissions 
       WHERE owner_id = ? AND admin_id = ? AND status = 'active'`,
      [invite.owner_id, payload.userId]
    );

    if (Array.isArray(existingPermission) && existingPermission.length > 0) {
      // ลบ invite เก่า
      await query('DELETE FROM admin_permissions WHERE id = ?', [invite.id]);
      
      return NextResponse.json({ 
        success: false, 
        message: 'คุณเป็นสมาชิกในทีมนี้อยู่แล้ว' 
      }, { status: 400 });
    }

    // ถ้า invite มี admin_id แล้ว (เชิญผ่าน email) ต้องตรวจสอบว่าตรงกับ user ที่ login
    if (invite.admin_id && invite.admin_id !== payload.userId) {
      return NextResponse.json({ 
        success: false, 
        message: 'คำเชิญนี้สำหรับ user อื่น' 
      }, { status: 403 });
    }

    // อัพเดท permission
    const thaiTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(' ', 'T');
    
    await query(
      `UPDATE admin_permissions 
       SET admin_id = ?, status = 'active', accepted_at = ?, invite_token = NULL
       WHERE id = ?`,
      [payload.userId, thaiTime, invite.id]
    );

    console.log(`✅ User ${payload.userId} accepted invite from owner ${invite.owner_id}`);

    return NextResponse.json({
      success: true,
      message: 'รับคำเชิญสำเร็จ คุณสามารถเข้าใช้งานระบบได้แล้ว'
    });
  } catch (error: any) {
    console.error('Accept invite error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด: ' + (error.message || 'Unknown') }, { status: 500 });
  }
}