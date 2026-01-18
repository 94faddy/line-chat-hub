'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FiMail, FiMessageCircle, FiArrowLeft } from 'react-icons/fi';
import Swal from 'sweetalert2';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (data.success) {
        setSent(true);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: data.message || 'ไม่พบอีเมลนี้ในระบบ',
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
      });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiMail className="w-10 h-10 text-line-green" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              ตรวจสอบอีเมลของคุณ
            </h1>
            <p className="text-gray-600 mb-6">
              เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง <strong>{email}</strong>
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left text-sm text-yellow-800 mb-6">
              <p><strong>💡 หมายเหตุ:</strong></p>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>ตรวจสอบโฟลเดอร์ Spam หากไม่พบอีเมล</li>
                <li>ลิงก์จะหมดอายุใน 1 ชั่วโมง</li>
              </ul>
            </div>
            <Link href="/auth/login" className="btn btn-primary w-full">
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-line-green rounded-xl flex items-center justify-center">
              <FiMessageCircle className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">BevChat Hub</span>
          </Link>
        </div>

        <div className="card p-8">
          <Link href="/auth/login" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6">
            <FiArrowLeft className="w-4 h-4" />
            กลับ
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ลืมรหัสผ่าน?
          </h1>
          <p className="text-gray-500 mb-8">
            กรอกอีเมลของคุณ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                อีเมล
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="example@email.com"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 text-base"
            >
              {loading ? (
                <div className="spinner w-5 h-5 border-white border-t-transparent" />
              ) : (
                'ส่งลิงก์รีเซ็ตรหัสผ่าน'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
