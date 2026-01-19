'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FiCheck, FiX, FiUser, FiLoader, FiAlertCircle } from 'react-icons/fi';
import Swal from 'sweetalert2';

interface InviteData {
  id: number;
  owner_name: string;
  owner_email: string;
  channel_name: string;
  permissions: any;
  expires_at: string;
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [requireLogin, setRequireLogin] = useState(false);

  useEffect(() => {
    if (token) {
      fetchInviteData();
    } else {
      setError('ไม่พบ Token ในลิงก์');
      setLoading(false);
    }
  }, [token]);

  const fetchInviteData = async () => {
    if (!token) return;
    
    try {
      console.log('Fetching invite data for token:', token);
      const res = await fetch(`/api/team/accept/${token}`);
      const data = await res.json();

      console.log('Response:', data);

      if (data.success) {
        setInviteData(data.data);
      } else {
        setError(data.message || 'ลิงก์ไม่ถูกต้อง');
      }
    } catch (error: any) {
      console.error('Error fetching invite:', error);
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token) return;
    
    setAccepting(true);
    setRequireLogin(false);
    
    try {
      const res = await fetch(`/api/team/accept/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'รับคำเชิญสำเร็จ!',
          text: 'คุณสามารถเข้าใช้งานระบบได้แล้ว',
          confirmButtonColor: '#06C755',
        });
        router.push('/dashboard');
      } else if (data.require_login) {
        setRequireLogin(true);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: data.message,
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถรับคำเชิญได้',
      });
    } finally {
      setAccepting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <FiLoader className="w-12 h-12 text-green-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">กำลังโหลด...</h2>
          <p className="text-gray-500">กรุณารอสักครู่</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiAlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">ลิงก์ไม่ถูกต้อง</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link href="/auth/login" className="btn btn-primary w-full justify-center">
            กลับหน้าล็อกอิน
          </Link>
        </div>
      </div>
    );
  }

  // Require login state
  if (requireLogin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiUser className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">กรุณาเข้าสู่ระบบ</h2>
          <p className="text-gray-500 mb-6">คุณต้องเข้าสู่ระบบก่อนรับคำเชิญ</p>
          
          {inviteData && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-gray-600">
                <strong>{inviteData.owner_name}</strong> เชิญคุณเป็นแอดมิน
              </p>
              <p className="text-sm text-gray-500">Channel: {inviteData.channel_name}</p>
            </div>
          )}
          
          <div className="space-y-3">
            <Link 
              href={`/auth/login?redirect=/auth/accept-invite?token=${token}`} 
              className="btn btn-primary w-full justify-center"
            >
              เข้าสู่ระบบ
            </Link>
            <Link 
              href={`/auth/register?redirect=/auth/accept-invite?token=${token}`} 
              className="btn btn-secondary w-full justify-center"
            >
              สมัครสมาชิกใหม่
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Main invite view
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiUser className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">คำเชิญเข้าร่วมทีม</h1>
          <p className="text-gray-500">คุณได้รับคำเชิญให้เป็นแอดมิน</p>
        </div>

        {/* Invite Info */}
        {inviteData && (
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">เชิญโดย</p>
                <p className="font-medium text-gray-900">{inviteData.owner_name}</p>
                <p className="text-sm text-gray-500">{inviteData.owner_email}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Channel</p>
                <p className="font-medium text-gray-900">{inviteData.channel_name}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">สิทธิ์ที่ได้รับ</p>
                <div className="flex flex-wrap gap-2">
                  {inviteData.permissions?.can_reply && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">ตอบแชท</span>
                  )}
                  {inviteData.permissions?.can_view_all && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">ดูทั้งหมด</span>
                  )}
                  {inviteData.permissions?.can_manage_tags && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">จัดการ Tags</span>
                  )}
                  {inviteData.permissions?.can_broadcast && (
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">Broadcast</span>
                  )}
                </div>
              </div>

              {inviteData.expires_at && (
                <div>
                  <p className="text-sm text-gray-500">หมดอายุ</p>
                  <p className="text-sm text-gray-700">
                    {new Date(inviteData.expires_at).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="btn btn-primary w-full justify-center py-3"
          >
            {accepting ? (
              <span className="flex items-center gap-2">
                <FiLoader className="w-5 h-5 animate-spin" />
                กำลังดำเนินการ...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <FiCheck className="w-5 h-5" />
                ยอมรับคำเชิญ
              </span>
            )}
          </button>
          
          <Link href="/" className="btn btn-secondary w-full justify-center py-3">
            <FiX className="w-5 h-5 mr-2" />
            ปฏิเสธ
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <FiLoader className="w-12 h-12 text-green-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">กำลังโหลด...</h2>
        </div>
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  );
}