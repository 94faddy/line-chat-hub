'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FiCheckCircle, FiXCircle, FiMessageCircle } from 'react-icons/fi';

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('ลิงก์ไม่ถูกต้อง');
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (data.success) {
          setStatus('success');
          setMessage('ยืนยันอีเมลสำเร็จ! คุณสามารถเข้าสู่ระบบได้แล้ว');
        } else {
          setStatus('error');
          setMessage(data.message || 'ลิงก์หมดอายุหรือไม่ถูกต้อง');
        }
      } catch (error) {
        setStatus('error');
        setMessage('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="card p-8 text-center">
      {status === 'loading' && (
        <>
          <div className="spinner w-16 h-16 border-4 mx-auto mb-6" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            กำลังยืนยันอีเมล...
          </h1>
          <p className="text-gray-500">กรุณารอสักครู่</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiCheckCircle className="w-10 h-10 text-line-green" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            ยืนยันอีเมลสำเร็จ!
          </h1>
          <p className="text-gray-600 mb-6">{message}</p>
          <Link href="/auth/login" className="btn btn-primary">
            เข้าสู่ระบบ
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiXCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            ยืนยันอีเมลไม่สำเร็จ
          </h1>
          <p className="text-gray-600 mb-6">{message}</p>
          <Link href="/auth/register" className="btn btn-primary">
            สมัครสมาชิกใหม่
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
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
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  );
}
