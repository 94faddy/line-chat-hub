'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  FiMessageCircle, FiLogOut, FiUser, FiChevronDown,
  FiSettings, FiExternalLink, FiHome
} from 'react-icons/fi';
import Swal from 'sweetalert2';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

const MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'https://bevchat.pro';

export default function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      
      if (data.success) {
        setUser(data.data);
      } else {
        // Redirect ไป main domain login
        window.location.href = `${MAIN_DOMAIN}/auth/login`;
      }
    } catch (error) {
      window.location.href = `${MAIN_DOMAIN}/auth/login`;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'ยืนยันการออกจากระบบ',
      text: 'คุณต้องการออกจากระบบหรือไม่?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#06C755',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
    });

    if (result.isConfirmed) {
      await fetch('/api/auth/logout', { method: 'POST' });
      // Redirect ไป main domain หลัง logout
      window.location.href = MAIN_DOMAIN;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="spinner w-12 h-12 border-4 mx-auto mb-4" />
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-line-green rounded-lg flex items-center justify-center">
              <FiMessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">BevChat</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Inbox
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Back to Dashboard */}
          <a
            href={`${MAIN_DOMAIN}/dashboard`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiHome className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
            <FiExternalLink className="w-3 h-3" />
          </a>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
                ) : (
                  <FiUser className="w-4 h-4 text-gray-500" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block max-w-[100px] truncate">
                {user?.name}
              </span>
              <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* User Dropdown Menu */}
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-56 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <a
                    href={`${MAIN_DOMAIN}/dashboard/profile`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <FiUser className="w-4 h-4" />
                    โปรไฟล์
                    <FiExternalLink className="w-3 h-3 ml-auto text-gray-400" />
                  </a>
                  <a
                    href={`${MAIN_DOMAIN}/dashboard/settings`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <FiSettings className="w-4 h-4" />
                    ตั้งค่า
                    <FiExternalLink className="w-3 h-3 ml-auto text-gray-400" />
                  </a>
                  <hr className="my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <FiLogOut className="w-4 h-4" />
                    ออกจากระบบ
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Page Content - Full Height */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}