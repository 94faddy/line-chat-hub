'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiPlus, FiMoreVertical, FiEdit2, FiTrash2, FiCopy, FiExternalLink, FiCheck } from 'react-icons/fi';
import Swal from 'sweetalert2';

interface Channel {
  id: number;
  channel_name: string;
  channel_id: string;
  basic_id?: string;
  picture_url?: string;
  webhook_url?: string;
  status: string;
  created_at: string;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      if (data.success) {
        setChannels(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (channel: Channel) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ?',
      html: `คุณต้องการลบ <strong>${channel.channel_name}</strong> หรือไม่?<br><br>
             <span class="text-red-500 text-sm">การลบจะทำให้ประวัติแชททั้งหมดหายไป</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/channels/${channel.id}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          setChannels(channels.filter(c => c.id !== channel.id));
          Swal.fire({
            icon: 'success',
            title: 'ลบสำเร็จ',
            showConfirmButton: false,
            timer: 1500,
          });
        }
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: 'ไม่สามารถลบได้',
        });
      }
    }
    setOpenMenu(null);
  };

  const copyWebhookUrl = (channel: Channel) => {
    const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://chat.bevchat.in'}/api/webhook/${channel.channel_id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(channel.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleStatus = async (channel: Channel) => {
    const newStatus = channel.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/channels/${channel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setChannels(channels.map(c => 
          c.id === channel.id ? { ...c, status: newStatus } : c
        ));
      }
    } catch (error) {
      console.error('Error:', error);
    }
    setOpenMenu(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-10 h-10 border-4" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LINE Channels</h1>
          <p className="text-gray-500">จัดการ LINE Official Account ที่เชื่อมต่อกับระบบ</p>
        </div>
        <Link href="/dashboard/channels/add" className="btn btn-primary">
          <FiPlus className="w-5 h-5 mr-2" />
          เพิ่ม LINE OA
        </Link>
      </div>

      {/* Channels Grid */}
      {channels.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">ยังไม่มี LINE Channel</h3>
          <p className="text-gray-500 mb-6">เริ่มต้นด้วยการเพิ่ม LINE Official Account ของคุณ</p>
          <Link href="/dashboard/channels/add" className="btn btn-primary">
            <FiPlus className="w-5 h-5 mr-2" />
            เพิ่ม LINE OA
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map(channel => (
            <div key={channel.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {channel.picture_url ? (
                    <img 
                      src={channel.picture_url} 
                      alt={channel.channel_name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-line-green/10 rounded-full flex items-center justify-center">
                      <span className="text-line-green font-bold text-lg">
                        {channel.channel_name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{channel.channel_name}</h3>
                    {channel.basic_id && (
                      <p className="text-sm text-gray-500">@{channel.basic_id}</p>
                    )}
                  </div>
                </div>
                
                <div className="relative">
                  <button 
                    onClick={() => setOpenMenu(openMenu === channel.id ? null : channel.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <FiMoreVertical className="w-4 h-4 text-gray-500" />
                  </button>
                  
                  {openMenu === channel.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setOpenMenu(null)}
                      />
                      <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        <Link
                          href={`/dashboard/channels/${channel.id}`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <FiEdit2 className="w-4 h-4" />
                          แก้ไข
                        </Link>
                        <button
                          onClick={() => copyWebhookUrl(channel)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {copiedId === channel.id ? (
                            <FiCheck className="w-4 h-4 text-green-500" />
                          ) : (
                            <FiCopy className="w-4 h-4" />
                          )}
                          คัดลอก Webhook URL
                        </button>
                        <button
                          onClick={() => toggleStatus(channel)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          <div className={`w-4 h-4 rounded-full ${channel.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {channel.status === 'active' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        </button>
                        <hr className="my-1" />
                        <button
                          onClick={() => handleDelete(channel)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <FiTrash2 className="w-4 h-4" />
                          ลบ
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">สถานะ</span>
                  <span className={`badge ${channel.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                    {channel.status === 'active' ? 'ใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Channel ID</span>
                  <span className="font-mono text-gray-700">{channel.channel_id}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <Link
                  href={`/dashboard?channel=${channel.id}`}
                  className="text-sm text-line-green hover:underline flex items-center gap-1"
                >
                  ดูแชททั้งหมด
                  <FiExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
