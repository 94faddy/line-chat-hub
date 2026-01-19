'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FiCheck, FiX, FiUser, FiMessageCircle, FiClock } from 'react-icons/fi';
import Swal from 'sweetalert2';

interface InviteData {
  id: number;
  owner_name: string;
  owner_email: string;
  channel_name: string;
  permissions: any;
  expires_at: string;
}

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteData | null>(null);

  useEffect(() => {
    if (token) {
      fetchInviteData();
    } else {
      setError('ไม่พบ Token');
      setLoading(false);
    }
  }, [token]);

  const fetchInviteData = async () => {
    try {
      const res = await fetch(`/api/team/accept/${token}`);
      const data = await res.json();

      if (data.success) {
        setInvite(data.data);
      } else {
        setError(data.message || 'ลิงก์เชิญไม่ถูกต้อง');
      }
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);

    try {
      const res = await fetch(`/api/team/accept/${token}`, {
        method: 'POST',
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'รับคำเชิญสำเร็จ!',
          text: 'คุณสามารถเข้าใช้งานระบบได้แล้ว',
          confirmButtonText: 'ไปที่ Dashboard',
        }).then(() => {
          router.push('/dashboard');
        });
      } else if (data.require_login) {
        // ต้อง login ก่อน
        Swal.fire({
          icon: 'info',
          title: 'กรุณาเข้าสู่ระบบ',
          text: 'คุณต้องเข้าสู่ระบบก่อนรับคำเชิญ',
          showCancelButton: true,
          confirmButtonText: 'เข้าสู่ระบบ',
          cancelButtonText: 'สมัครสมาชิก',
        }).then((result) => {
          if (result.isConfirmed) {
            router.push(`/auth/login?redirect=/auth/accept-invite?token=${token}`);
          } else if (result.dismiss === Swal.DismissReason.cancel) {
            router.push(`/auth/register?redirect=/auth/accept-invite?token=${token}`);
          }
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: data.message,
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถรับคำเชิญได้',
      });
    } finally {
      setAccepting(false);
    }
  };

  const formatPermissions = (permissions: any) => {
    if (!permissions) return [];
    const perms = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
    const labels: string[] = [];
    if (perms.can_reply) labels.push('ตอบแชท');
    if (perms.can_view_all) labels.push('ดูแชททั้งหมด');
    if (perms.can_manage_tags) labels.push('จัดการ Tags');
    if (perms.can_broadcast) labels.push('ส่ง Broadcast');
    return labels;
  };

  const formatExpiry = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="spinner w-12 h-12 border-4 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiX className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">ลิงก์ไม่ถูกต้อง</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="btn btn-primary w-full"
          >
            กลับไปหน้า Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiMessageCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">คำเชิญเข้าร่วมทีม</h1>
          <p className="text-gray-600">คุณได้รับเชิญให้เข้าร่วมทีม</p>
        </div>

        {invite && (
          <div className="space-y-4 mb-6">
            {/* เจ้าของ */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <FiUser className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{invite.owner_name || 'ผู้ใช้'}</p>
                  <p className="text-sm text-gray-500">{invite.owner_email}</p>
                </div>
              </div>
            </div>

            {/* Channel */}
            <div>
              <label className="text-sm font-medium text-gray-500">Channel</label>
              <p className="text-gray-900">{invite.channel_name}</p>
            </div>

            {/* สิทธิ์ */}
            <div>
              <label className="text-sm font-medium text-gray-500">สิทธิ์ที่จะได้รับ</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {formatPermissions(invite.permissions).map((perm, i) => (
                  <span key={i} className="tag bg-blue-100 text-blue-700">{perm}</span>
                ))}
              </div>
            </div>

            {/* วันหมดอายุ */}
            {invite.expires_at && (
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <FiClock className="w-4 h-4" />
                <span>หมดอายุ: {formatExpiry(invite.expires_at)}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/')}
            className="btn btn-secondary flex-1"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="btn btn-primary flex-1"
          >
            {accepting ? (
              <span className="flex items-center gap-2">
                <div className="spinner w-4 h-4 border-white border-t-transparent"></div>
                กำลังรับ...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <FiCheck className="w-5 h-5" />
                รับคำเชิญ
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}