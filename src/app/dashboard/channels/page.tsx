'use client';

import { useEffect, useState } from 'react';
import { FiPlus, FiTrash2, FiEdit2, FiCheck, FiCopy, FiMessageCircle, FiUsers, FiEye, FiEyeOff } from 'react-icons/fi';
import Swal from 'sweetalert2';

interface Channel {
  id: number;
  channel_name: string;
  channel_id: string;
  channel_access_token: string;
  channel_secret: string;
  webhook_url: string;
  is_active: boolean;
  created_at: string;
  message_count?: number;
  user_count?: number;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [showTokens, setShowTokens] = useState<{ [key: number]: boolean }>({});
  const [form, setForm] = useState({
    channel_name: '',
    channel_id: '',
    channel_access_token: '',
    channel_secret: ''
  });
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingChannel ? `/api/channels/${editingChannel.id}` : '/api/channels';
      const method = editingChannel ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: editingChannel ? 'อัพเดทสำเร็จ' : 'เพิ่ม Channel สำเร็จ',
          timer: 1500,
          showConfirmButton: false,
        });
        setShowAddModal(false);
        setEditingChannel(null);
        resetForm();
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
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (channel: Channel) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ Channel?',
      html: `
        <div class="text-left">
          <p class="mb-2">ต้องการลบ <strong>${channel.channel_name}</strong> หรือไม่?</p>
          <p class="text-red-600 text-sm">⚠️ ข้อมูลที่จะถูกลบทั้งหมด:</p>
          <ul class="text-sm text-gray-600 list-disc list-inside ml-2">
            <li>ข้อความแชททั้งหมด</li>
            <li>ผู้ใช้ LINE ทั้งหมด</li>
            <li>สิทธิ์ทีมงานที่เกี่ยวข้อง</li>
          </ul>
          <p class="text-red-600 text-sm mt-2 font-semibold">การลบนี้ไม่สามารถเรียกคืนได้!</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ลบ Channel',
      cancelButtonText: 'ยกเลิก',
      focusCancel: true,
    });

    if (result.isConfirmed) {
      // ยืนยันอีกครั้งด้วยการพิมพ์ชื่อ
      const confirmResult = await Swal.fire({
        title: 'พิมพ์ชื่อ Channel เพื่อยืนยัน',
        input: 'text',
        inputPlaceholder: channel.channel_name,
        inputValidator: (value) => {
          if (value !== channel.channel_name) {
            return 'ชื่อ Channel ไม่ตรงกัน';
          }
          return null;
        },
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        confirmButtonText: 'ยืนยันลบ',
        cancelButtonText: 'ยกเลิก',
      });

      if (confirmResult.isConfirmed) {
        try {
          const res = await fetch(`/api/channels/${channel.id}`, {
            method: 'DELETE',
          });

          const data = await res.json();

          if (data.success) {
            setChannels(channels.filter(c => c.id !== channel.id));
            Swal.fire({
              icon: 'success',
              title: 'ลบสำเร็จ',
              text: data.message,
              timer: 2000,
              showConfirmButton: false,
            });
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
    }
  };

  const handleEdit = (channel: Channel) => {
    setEditingChannel(channel);
    setForm({
      channel_name: channel.channel_name,
      channel_id: channel.channel_id,
      channel_access_token: channel.channel_access_token,
      channel_secret: channel.channel_secret,
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setForm({
      channel_name: '',
      channel_id: '',
      channel_access_token: '',
      channel_secret: ''
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({
      icon: 'success',
      title: `คัดลอก ${label} แล้ว`,
      timer: 1000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
    });
  };

  const toggleShowToken = (channelId: number) => {
    setShowTokens(prev => ({ ...prev, [channelId]: !prev[channelId] }));
  };

  const maskToken = (token: string) => {
    if (!token) return '';
    if (token.length <= 10) return '••••••••••';
    return token.substring(0, 5) + '••••••••' + token.substring(token.length - 5);
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
          <p className="text-gray-500">จัดการช่องทาง LINE Official Account</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingChannel(null);
            setShowAddModal(true);
          }}
          className="btn btn-primary"
        >
          <FiPlus className="w-5 h-5 mr-2" />
          เพิ่ม Channel
        </button>
      </div>

      {/* Channels List */}
      {channels.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiMessageCircle className="w-10 h-10 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">ยังไม่มี LINE Channel</h3>
          <p className="text-gray-500 mb-6">เพิ่ม LINE Official Account เพื่อเริ่มรับส่งข้อความ</p>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="btn btn-primary"
          >
            <FiPlus className="w-5 h-5 mr-2" />
            เพิ่ม Channel
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {channels.map(channel => (
            <div key={channel.id} className="card p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <FiMessageCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{channel.channel_name}</h3>
                      <p className="text-sm text-gray-500">Channel ID: {channel.channel_id}</p>
                    </div>
                    {channel.is_active ? (
                      <span className="badge badge-green ml-2">
                        <FiCheck className="w-3 h-3 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-gray ml-2">Inactive</span>
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

                  {/* Tokens */}
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Access Token</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm bg-white px-3 py-1.5 rounded border truncate">
                          {showTokens[channel.id] ? channel.channel_access_token : maskToken(channel.channel_access_token)}
                        </code>
                        <button
                          onClick={() => toggleShowToken(channel.id)}
                          className="p-1.5 text-gray-500 hover:text-gray-700"
                          title={showTokens[channel.id] ? 'ซ่อน' : 'แสดง'}
                        >
                          {showTokens[channel.id] ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(channel.channel_access_token, 'Access Token')}
                          className="p-1.5 text-gray-500 hover:text-gray-700"
                          title="คัดลอก"
                        >
                          <FiCopy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Channel Secret</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm bg-white px-3 py-1.5 rounded border truncate">
                          {showTokens[channel.id] ? channel.channel_secret : maskToken(channel.channel_secret)}
                        </code>
                        <button
                          onClick={() => copyToClipboard(channel.channel_secret, 'Channel Secret')}
                          className="p-1.5 text-gray-500 hover:text-gray-700"
                          title="คัดลอก"
                        >
                          <FiCopy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {channel.webhook_url && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Webhook URL</label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm bg-white px-3 py-1.5 rounded border truncate">
                            {channel.webhook_url}
                          </code>
                          <button
                            onClick={() => copyToClipboard(channel.webhook_url, 'Webhook URL')}
                            className="p-1.5 text-gray-500 hover:text-gray-700"
                            title="คัดลอก"
                          >
                            <FiCopy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(channel)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="แก้ไข"
                  >
                    <FiEdit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(channel)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="ลบ"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">
                {editingChannel ? 'แก้ไข Channel' : 'เพิ่ม LINE Channel'}
              </h2>
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
                    setEditingChannel(null);
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
                  ) : editingChannel ? (
                    'อัพเดท'
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