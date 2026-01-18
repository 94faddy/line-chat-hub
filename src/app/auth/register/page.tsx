'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff, FiMessageCircle, FiCheck } from 'react-icons/fi';
import Swal from 'sweetalert2';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'สมัครสมาชิกไม่สำเร็จ',
          text: data.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
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

  if (success) {
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
              เราได้ส่งลิงก์ยืนยันไปยัง <strong>{formData.email}</strong> 
              <br />กรุณาคลิกลิงก์ในอีเมลเพื่อเปิดใช้งานบัญชีของคุณ
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left text-sm text-yellow-800 mb-6">
              <p><strong>💡 หมายเหตุ:</strong></p>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>ตรวจสอบโฟลเดอร์ Spam หากไม่พบอีเมล</li>
                <li>ลิงก์จะหมดอายุใน 24 ชั่วโมง</li>
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

        {/* Register Card */}
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            สมัครสมาชิก
          </h1>
          <p className="text-gray-500 text-center mb-8">
            สร้างบัญชีเพื่อเริ่มใช้งาน
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                ชื่อ-นามสกุล
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input pl-10"
                  placeholder="ชื่อของคุณ"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                อีเมล
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input pl-10"
                  placeholder="example@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                รหัสผ่าน
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
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
                ยืนยันรหัสผ่าน
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input pl-10"
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  required
                />
                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <FiCheck className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 w-5 h-5" />
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <input type="checkbox" id="terms" className="w-4 h-4 mt-1 rounded border-gray-300 text-line-green focus:ring-line-green" required />
              <label htmlFor="terms" className="text-sm text-gray-600">
                ฉันยอมรับ <a href="#" className="text-line-green hover:underline">เงื่อนไขการใช้งาน</a> และ <a href="#" className="text-line-green hover:underline">นโยบายความเป็นส่วนตัว</a>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 text-base"
            >
              {loading ? (
                <div className="spinner w-5 h-5 border-white border-t-transparent" />
              ) : (
                'สมัครสมาชิก'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-gray-500">มีบัญชีอยู่แล้ว? </span>
            <Link href="/auth/login" className="text-line-green hover:underline font-medium">
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
