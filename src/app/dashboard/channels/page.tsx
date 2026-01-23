// src/app/dashboard/channels/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiPlus, FiTrash2, FiCheck, FiMessageCircle, FiUsers, FiSettings, FiRefreshCw, FiArchive, FiAlertTriangle } from 'react-icons/fi';
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
  deleted_at?: string;
  message_count?: number;
  user_count?: number;
  isOwner?: boolean;
  permissions?: {
    can_reply?: boolean;
    can_view_all?: boolean;
    can_broadcast?: boolean;
    can_manage_tags?: boolean;
    can_manage_channel?: boolean;
  };
}

type TabType = 'active' | 'inactive' | 'deleted';

export default function ChannelsPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [form, setForm] = useState({
    channel_name: '',
    channel_id: '',
    channel_access_token: '',
    channel_secret: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, [activeTab]);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      // ✅ เพิ่ม query parameter ตาม tab
      const res = await fetch(`/api/channels?status=${activeTab}`);
      const data = await res.json();
      if (data.success) {
        // Filter เฉพาะ channels ที่มีสิทธิ์ can_manage_channel หรือเป็น owner
        const filteredChannels = data.data.filter((ch: Channel) => 
          ch.isOwner || ch.permissions?.can_manage_channel
        );
        setChannels(filteredChannels);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (data.success) {
        // ✅ ตรวจสอบว่าเป็นการ restore หรือไม่
        if (data.data.restored) {
          Swal.fire({
            icon: 'success',
            title: 'กู้คืน Channel สำเร็จ!',
            html: `
              <p class="mb-4">Channel ถูกกู้คืนพร้อมข้อมูลเดิมทั้งหมด</p>
              <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                ✅ ประวัติแชท, ผู้ติดตาม, Tags และ Quick Replies กลับมาครบ
              </div>
            `,
            confirmButtonColor: '#06C755',
          });
        } else {
          Swal.fire({
            icon: 'success',
            title: 'เพิ่ม Channel สำเร็จ',
            html: `
              <p class="mb-4">กรุณานำ Webhook URL ไปตั้งค่าที่ LINE Developers Console</p>
              <div class="bg-gray-100 p-3 rounded-lg text-sm text-left break-all font-mono">
                ${data.data.webhook_url}
              </div>
            `,
            confirmButtonColor: '#06C755',
          });
        }
        setShowAddModal(false);
        resetForm();
        setActiveTab('active');
        fetchChannels();
      } else if (res.status === 409 && data.canRestore) {
        // ✅ จัดการ 409 Conflict - Channel เคยถูก soft delete (inactive)
        const restoreResult = await Swal.fire({
          icon: 'question',
          title: 'พบ Channel ที่ถูกปิดใช้งาน',
          html: `
            <div class="text-left">
              <p class="mb-3">Channel ID นี้ถูกปิดใช้งานอยู่ในระบบ</p>
              <p class="text-gray-600">คุณต้องการเปิดใช้งานใหม่หรือไม่?</p>
              <div class="bg-green-50 border border-green-200 rounded-lg p-3 mt-3 text-sm text-green-800">
                ✅ ข้อมูลเดิมทั้งหมดจะกลับมาครบ
              </div>
            </div>
          `,
          showCancelButton: true,
          confirmButtonColor: '#06C755',
          cancelButtonColor: '#6B7280',
          confirmButtonText: 'เปิดใช้งานใหม่',
          cancelButtonText: 'ยกเลิก',
        });

        if (restoreResult.isConfirmed) {
          await handleRestore({ id: data.existingChannelId, channel_name: data.existingChannelName } as Channel);
          setShowAddModal(false);
          resetForm();
        }
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
      });
    } finally {
      setSaving(false);
    }
  };

  // ✅ ฟังก์ชัน Restore (เปิดใช้งานใหม่)
  const handleRestore = async (channel: Channel) => {
    const result = await Swal.fire({
      title: 'เปิดใช้งาน Channel?',
      html: `
        <p>ต้องการเปิดใช้งาน <strong>${channel.channel_name || 'Channel นี้'}</strong> อีกครั้งหรือไม่?</p>
        <p class="text-sm text-gray-500 mt-2">ข้อมูลทั้งหมดจะกลับมาเหมือนเดิม</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#06C755',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'เปิดใช้งาน',
      cancelButtonText: 'ยกเลิก',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/channels/${channel.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore' }),
        });

        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'เปิดใช้งานสำเร็จ',
            text: 'Channel กลับมาใช้งานได้แล้ว',
            timer: 2000,
            showConfirmButton: false,
          });
          setActiveTab('active');
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
        });
      }
    }
  };

  // ✅ ฟังก์ชัน Soft Delete (ปิดใช้งาน)
  const handleSoftDelete = async (channel: Channel) => {
    if (!channel.isOwner) {
      Swal.fire({
        icon: 'error',
        title: 'ไม่สามารถปิดใช้งานได้',
        text: 'เฉพาะเจ้าของ Channel เท่านั้นที่สามารถปิดใช้งานได้',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'ปิดใช้งาน Channel?',
      html: `
        <div class="text-left">
          <p class="mb-2">ต้องการปิดใช้งาน <strong>${channel.channel_name}</strong> หรือไม่?</p>
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
            <p class="text-blue-800 text-sm">💡 <strong>ข้อมูลจะไม่ถูกลบ</strong></p>
            <ul class="text-sm text-blue-700 list-disc list-inside ml-2 mt-1">
              <li>ข้อมูลการสนทนาทั้งหมดจะยังอยู่</li>
              <li>ผู้ใช้ LINE ทั้งหมดจะยังอยู่</li>
              <li>สามารถเปิดใช้งานใหม่ได้ทุกเมื่อ</li>
            </ul>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#F59E0B',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ปิดใช้งาน',
      cancelButtonText: 'ยกเลิก',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/channels/${channel.id}`, {
          method: 'DELETE',
        });

        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'ปิดใช้งานสำเร็จ',
            html: `
              <p>Channel <strong>${channel.channel_name}</strong> ถูกปิดใช้งานแล้ว</p>
              <p class="text-sm text-gray-500 mt-2">คุณสามารถเปิดใช้งานใหม่ได้ที่ Tab "ปิดใช้งาน"</p>
            `,
            timer: 3000,
            showConfirmButton: true,
            confirmButtonColor: '#06C755',
          });
          fetchChannels();
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
        });
      }
    }
  };

  // ✅ ฟังก์ชัน Hard Delete (ลบถาวร)
  const handleHardDelete = async (channel: Channel) => {
    if (!channel.isOwner) {
      Swal.fire({
        icon: 'error',
        title: 'ไม่สามารถลบได้',
        text: 'เฉพาะเจ้าของ Channel เท่านั้นที่สามารถลบได้',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'ลบ Channel ถาวร?',
      html: `
        <div class="text-left">
          <p class="mb-2">ต้องการลบ <strong>${channel.channel_name}</strong> ถาวรหรือไม่?</p>
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
            <p class="text-red-800 text-sm">⚠️ <strong>การดำเนินการนี้</strong></p>
            <ul class="text-sm text-red-700 list-disc list-inside ml-2 mt-1">
              <li>Credentials จะถูกลบออก</li>
              <li>ไม่สามารถกู้คืนได้จากหน้านี้</li>
            </ul>
          </div>
          <div class="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
            <p class="text-green-800 text-sm">✅ <strong>แต่ข้อมูลยังอยู่</strong></p>
            <ul class="text-sm text-green-700 list-disc list-inside ml-2 mt-1">
              <li>ถ้าเพิ่ม Channel ID นี้ใหม่</li>
              <li>ข้อมูลเดิมจะกลับมาทั้งหมด</li>
            </ul>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ลบถาวร',
      cancelButtonText: 'ยกเลิก',
      input: 'text',
      inputPlaceholder: `พิมพ์ "${channel.channel_id}" เพื่อยืนยัน`,
      inputValidator: (value) => {
        if (value !== channel.channel_id) {
          return 'Channel ID ไม่ถูกต้อง';
        }
        return null;
      }
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/channels/${channel.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'hard_delete' }),
        });

        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'ลบ Channel สำเร็จ',
            html: `
              <p>Channel ถูกลบแล้ว</p>
              <p class="text-sm text-gray-500 mt-2">ถ้าต้องการใช้งานอีกครั้ง ให้เพิ่ม Channel ใหม่ด้วย Channel ID เดิม</p>
            `,
            confirmButtonColor: '#06C755',
          });
          fetchChannels();
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
        });
      }
    }
  };

  const resetForm = () => {
    setForm({
      channel_name: '',
      channel_id: '',
      channel_access_token: '',
      channel_secret: ''
    });
  };

  const getTabLabel = (tab: TabType) => {
    switch (tab) {
      case 'active': return 'ใช้งาน';
      case 'inactive': return 'ปิดใช้งาน';
      case 'deleted': return 'ลบแล้ว';
    }
  };

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'active': return 'ยังไม่มี Channel ที่ใช้งานอยู่';
      case 'inactive': return 'ไม่มี Channel ที่ถูกปิดใช้งาน';
      case 'deleted': return 'ไม่มี Channel ที่ถูกลบ';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="badge badge-green">
            <FiCheck className="w-3 h-3 mr-1" />
            Active
          </span>
        );
      case 'inactive':
        return (
          <span className="badge badge-yellow">
            <FiArchive className="w-3 h-3 mr-1" />
            Inactive
          </span>
        );
      case 'deleted':
        return (
          <span className="badge badge-red">
            <FiTrash2 className="w-3 h-3 mr-1" />
            Deleted
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LINE Channels</h1>
          <p className="text-gray-500 mt-1">จัดการ LINE Official Account ของคุณ</p>
        </div>
        <button 
          onClick={() => router.push('/dashboard/channels/add')}
          className="btn btn-primary flex items-center gap-2"
        >
          <FiPlus className="w-5 h-5" />
          เพิ่ม Channel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['active', 'inactive', 'deleted'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? tab === 'deleted' 
                  ? 'border-red-500 text-red-600'
                  : tab === 'inactive'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {getTabLabel(tab)}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="spinner w-10 h-10 border-4" />
        </div>
      ) : channels.length === 0 ? (
        // Empty State
        <div className="text-center py-16">
          <div className={`w-20 h-20 ${activeTab === 'deleted' ? 'bg-red-100' : activeTab === 'inactive' ? 'bg-yellow-100' : 'bg-gray-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            {activeTab === 'deleted' ? (
              <FiTrash2 className="w-10 h-10 text-red-400" />
            ) : activeTab === 'inactive' ? (
              <FiArchive className="w-10 h-10 text-yellow-400" />
            ) : (
              <FiMessageCircle className="w-10 h-10 text-gray-400" />
            )}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{getEmptyMessage()}</h3>
          {activeTab === 'active' && (
            <>
              <p className="text-gray-500 mb-4">เริ่มต้นด้วยการเพิ่ม LINE Channel แรกของคุณ</p>
              <button 
                onClick={() => router.push('/dashboard/channels/add')}
                className="btn btn-primary"
              >
                <FiPlus className="w-4 h-4 mr-2" />
                เพิ่ม Channel
              </button>
            </>
          )}
          {activeTab === 'deleted' && (
            <p className="text-gray-500">ถ้าต้องการกู้คืน ให้เพิ่ม Channel ใหม่ด้วย Channel ID เดิม</p>
          )}
        </div>
      ) : (
        // Channel List
        <div className="space-y-4">
          {channels.map((channel) => (
            <div 
              key={channel.id} 
              className={`card p-6 hover:shadow-md transition-shadow ${
                activeTab === 'deleted' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Channel Info */}
                  <div className="flex items-center gap-4 mb-3">
                    {channel.picture_url ? (
                      <img 
                        src={channel.picture_url} 
                        alt={channel.channel_name}
                        className={`w-12 h-12 rounded-xl object-cover ${activeTab !== 'active' ? 'opacity-50 grayscale' : ''}`}
                      />
                    ) : (
                      <div className={`w-12 h-12 ${
                        activeTab === 'deleted' ? 'bg-red-100' : 
                        activeTab === 'inactive' ? 'bg-yellow-100' : 'bg-green-100'
                      } rounded-xl flex items-center justify-center`}>
                        <FiMessageCircle className={`w-6 h-6 ${
                          activeTab === 'deleted' ? 'text-red-400' :
                          activeTab === 'inactive' ? 'text-yellow-500' : 'text-green-600'
                        }`} />
                      </div>
                    )}
                    <div>
                      <h3 className={`text-lg font-semibold ${activeTab !== 'active' ? 'text-gray-500' : 'text-gray-900'}`}>
                        {channel.channel_name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>Channel ID: {channel.channel_id}</span>
                        {channel.basic_id && (
                          <>
                            <span>•</span>
                            <span>{channel.basic_id}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(channel.status)}
                    {!channel.isOwner && (
                      <span className="badge badge-blue ml-2">Admin</span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex gap-6 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FiUsers className="w-4 h-4" />
                      <span>{channel.user_count || 0} ผู้ใช้</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FiMessageCircle className="w-4 h-4" />
                      <span>{channel.message_count || 0} ข้อความ</span>
                    </div>
                  </div>

                  {/* Dates */}
                  <p className="text-xs text-gray-400">
                    {channel.deleted_at ? (
                      <>
                        {activeTab === 'deleted' ? 'ลบเมื่อ' : 'ปิดใช้งานเมื่อ'}: {new Date(channel.deleted_at).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </>
                    ) : (
                      <>
                        สร้างเมื่อ: {new Date(channel.created_at).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  {activeTab === 'active' && (
                    <>
                      <button
                        onClick={() => router.push(`/dashboard/channels/${channel.id}`)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="ตั้งค่า"
                      >
                        <FiSettings className="w-5 h-5" />
                      </button>
                      {channel.isOwner && (
                        <button
                          onClick={() => handleSoftDelete(channel)}
                          className="p-2 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                          title="ปิดใช้งาน"
                        >
                          <FiArchive className="w-5 h-5" />
                        </button>
                      )}
                    </>
                  )}
                  
                  {activeTab === 'inactive' && channel.isOwner && (
                    <>
                      <button
                        onClick={() => handleRestore(channel)}
                        className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="เปิดใช้งานใหม่"
                      >
                        <FiRefreshCw className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleHardDelete(channel)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="ลบถาวร"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  
                  {activeTab === 'deleted' && (
                    <div className="text-sm text-gray-400 italic">
                      เพิ่ม Channel ใหม่เพื่อกู้คืน
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">เพิ่ม LINE Channel</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อ Channel
                </label>
                <input
                  type="text"
                  value={form.channel_name}
                  onChange={(e) => setForm({ ...form, channel_name: e.target.value })}
                  placeholder="เช่น My Shop LINE OA"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Channel ID
                </label>
                <input
                  type="text"
                  value={form.channel_id}
                  onChange={(e) => setForm({ ...form, channel_id: e.target.value })}
                  placeholder="จาก LINE Developers Console"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Channel Access Token
                </label>
                <textarea
                  value={form.channel_access_token}
                  onChange={(e) => setForm({ ...form, channel_access_token: e.target.value })}
                  placeholder="Long-lived access token จาก LINE Developers"
                  className="input min-h-[80px]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Channel Secret
                </label>
                <input
                  type="text"
                  value={form.channel_secret}
                  onChange={(e) => setForm({ ...form, channel_secret: e.target.value })}
                  placeholder="Channel secret จาก LINE Developers"
                  className="input"
                  required
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 คุณสามารถหาข้อมูลเหล่านี้ได้จาก{' '}
                  <a 
                    href="https://developers.line.biz/console/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    LINE Developers Console
                  </a>
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="btn btn-secondary flex-1"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary flex-1"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <div className="spinner w-4 h-4 border-white border-t-transparent" />
                      กำลังบันทึก...
                    </span>
                  ) : (
                    'เพิ่ม Channel'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}