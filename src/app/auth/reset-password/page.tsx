'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiLock, FiEye, FiEyeOff, FiMessageCircle } from 'react-icons/fi';
import Swal from 'sweetalert2';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'รหัสผ่านไม่ตรงกัน',
        text: 'กรุณากรอกรหัสผ่านให้ตรงกัน',
      });
      return;
    }

    if (formData.password.length < 6) {
      Swal.fire({
        icon: 'error',
        title: 'รหัสผ่านสั้นเกินไป',
        text: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'รีเซ็ตรหัสผ่านสำเร็จ!',
          text: 'คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว',
        });
        router.push('/auth/login');
      } else {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: data.message || 'ลิงก์หมดอายุหรือไม่ถูกต้อง',
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

  if (!token) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          ลิงก์ไม่ถูกต้อง
        </h1>
        <p className="text-gray-600 mb-6">
          ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว
        </p>
        <Link href="/auth/forgot-password" className="btn btn-primary">
          ขอลิงก์ใหม่
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
        ตั้งรหัสผ่านใหม่
      </h1>
      <p className="text-gray-500 text-center mb-8">
        กรอกรหัสผ่านใหม่ของคุณ
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            รหัสผ่านใหม่
          </label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="input pl-10 pr-10"
              placeholder="อย่างน้อย 6 ตัวอักษร"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            ยืนยันรหัสผ่านใหม่
          </label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              className="input pl-10"
              placeholder="กรอกรหัสผ่านอีกครั้ง"
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
            'ตั้งรหัสผ่านใหม่'
          )}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-line-green rounded-xl flex items-center justify-center">
              <FiMessageCircle className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">BevChat Hub</span>
          </Link>
        </div>

        <Suspense fallback={<div className="card p-8 text-center"><div className="spinner w-8 h-8 mx-auto" /></div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
