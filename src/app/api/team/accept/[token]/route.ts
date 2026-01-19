import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET - ดึงข้อมูล invite จาก token (จาก URL path)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ success: false, message: 'Token is required' }, { status: 400 });
    }

    console.log(`🔍 [Accept Invite] Looking for token: ${token}`);

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
      console.log(`❌ [Accept Invite] Token not found or expired: ${token}`);
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
        console.log(`❌ [Accept Invite] Token expired: ${token}`);
        return NextResponse.json({ 
          success: false, 
          message: 'ลิงก์เชิญหมดอายุแล้ว' 
        }, { status: 410 });
      }
    }

    // Parse permissions
    let permissions = {};
    try {
      permissions = typeof invite.permissions === 'string' ? JSON.parse(invite.permissions) : invite.permissions || {};
    } catch {
      permissions = {};
    }

    console.log(`✅ [Accept Invite] Found valid invite from owner: ${invite.owner_name}`);

    return NextResponse.json({
      success: true,
      data: {
        id: invite.id,
        owner_name: invite.owner_name,
        owner_email: invite.owner_email,
        channel_name: invite.channel_name || 'ทุก Channel',
        permissions: permissions,
        expires_at: invite.invite_expires_at
      }
    });
  } catch (error: any) {
    console.error('Get invite error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด: ' + (error.message || 'Unknown') }, { status: 500 });
  }
}

// POST - Accept invite
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ success: false, message: 'Token is required' }, { status: 400 });
    }
    
    console.log(`🔐 [Accept Invite] Attempting to accept token: ${token}`);
    
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

    console.log(`👤 [Accept Invite] User ${payload.userId} trying to accept`);

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
      // ลบ invite record เพราะ user มี permission อยู่แล้ว
      await query('DELETE FROM admin_permissions WHERE id = ?', [invite.id]);
      
      return NextResponse.json({ 
        success: false, 
        message: 'คุณเป็นสมาชิกในทีมนี้อยู่แล้ว' 
      }, { status: 400 });
    }

    // Parse และ clean permissions
    let permissions = {};
    try {
      permissions = typeof invite.permissions === 'string' ? JSON.parse(invite.permissions) : invite.permissions || {};
    } catch {
      permissions = {};
    }
    
    const thaiTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(' ', 'T');
    
    // อัพเดท permission
    await query(
      `UPDATE admin_permissions 
       SET admin_id = ?, status = 'active', accepted_at = ?, invite_token = NULL, permissions = ?
       WHERE id = ?`,
      [payload.userId, thaiTime, JSON.stringify(permissions), invite.id]
    );

    console.log(`✅ [Accept Invite] User ${payload.userId} accepted invite from owner ${invite.owner_id}`);

    return NextResponse.json({
      success: true,
      message: 'รับคำเชิญสำเร็จ คุณสามารถเข้าใช้งานระบบได้แล้ว'
    });
  } catch (error: any) {
    console.error('Accept invite error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด: ' + (error.message || 'Unknown') }, { status: 500 });
  }
}