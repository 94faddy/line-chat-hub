'use client';

import { useEffect, useState } from 'react';
import { 
  FiMessageCircle, FiSend, FiUsers, FiRadio, FiImage,
  FiClock, FiCheckCircle, FiXCircle, FiEye, FiTrash2,
  FiFilter, FiCalendar
} from 'react-icons/fi';
import Swal from 'sweetalert2';

interface Broadcast {
  id: number;
  channel_id: number;
  channel_name: string;
  message_type: 'text' | 'image' | 'template';
  content: string;
  target_type: 'all' | 'segment' | 'tags';
  target_count: number;
  sent_count: number;
  failed_count: number;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

interface Channel {
  id: number;
  name: string;
  followers_count: number;
}

export default function BroadcastPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const [form, setForm] = useState({
    channel_id: '',
    message_type: 'text' as 'text' | 'image',
    content: '',
    image_url: '',
    target_type: 'all' as 'all' | 'segment',
    scheduled_at: ''
  });

  useEffect(() => {
    fetchBroadcasts();
    fetchChannels();
  }, []);

  const fetchBroadcasts = async () => {
    try {
      const res = await fetch('/api/broadcast');
      const data = await res.json();
      if (data.success) {
        setBroadcasts(data.data);
      }
    } catch (error) {
      console.error('Error fetching broadcasts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      if (data.success) {
        setChannels(data.data);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.channel_id) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณาเลือก Channel',
        text: 'โปรดเลือก LINE OA ที่ต้องการส่งข้อความ'
      });
      return;
    }

    if (!form.content.trim() && form.message_type === 'text') {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณาใส่ข้อความ',
        text: 'โปรดใส่ข้อความที่ต้องการส่ง'
      });
      return;
    }

    const channel = channels.find(c => c.id === parseInt(form.channel_id));
    
    const result = await Swal.fire({
      title: 'ยืนยันการส่ง Broadcast',
      html: `
        <div class="text-left">
          <p><strong>Channel:</strong> ${channel?.name}</p>
          <p><strong>กลุ่มเป้าหมาย:</strong> ${form.target_type === 'all' ? 'ผู้ติดตามทั้งหมด' : 'กลุ่มที่เลือก'}</p>
          <p><strong>จำนวน:</strong> ~${channel?.followers_count || 0} คน</p>
          ${form.scheduled_at ? `<p><strong>กำหนดส่ง:</strong> ${new Date(form.scheduled_at).toLocaleString('th-TH')}</p>` : ''}
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#06C755',
      cancelButtonColor: '#6B7280',
      confirmButtonText: form.scheduled_at ? 'ตั้งเวลาส่ง' : 'ส่งทันที',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      setSending(true);
      try {
        const res = await fetch('/api/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel_id: parseInt(form.channel_id),
            message_type: form.message_type,
            content: form.message_type === 'text' ? form.content : form.image_url,
            target_type: form.target_type,
            scheduled_at: form.scheduled_at || null
          })
        });

        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: form.scheduled_at ? 'ตั้งเวลาส่งเรียบร้อย' : 'กำลังส่งข้อความ',
            text: form.scheduled_at 
              ? `ข้อความจะถูกส่งในวันที่ ${new Date(form.scheduled_at).toLocaleString('th-TH')}`
              : 'ระบบกำลังส่งข้อความไปยังผู้ติดตามทั้งหมด',
            timer: 3000,
            showConfirmButton: false
          });
          setShowCompose(false);
          resetForm();
          fetchBroadcasts();
        } else {
          throw new Error(data.error);
        }
      } catch (error: any) {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: error.message || 'ไม่สามารถส่งข้อความได้'
        });
      } finally {
        setSending(false);
      }
    }
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ',
      text: 'คุณต้องการลบ Broadcast นี้หรือไม่?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/broadcast/${id}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'ลบสำเร็จ',
            timer: 1500,
            showConfirmButton: false
          });
          fetchBroadcasts();
        }
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: 'ไม่สามารถลบได้'
        });
      }
    }
  };

  const resetForm = () => {
    setForm({
      channel_id: '',
      message_type: 'text',
      content: '',
      image_url: '',
      target_type: 'all',
      scheduled_at: ''
    });
  };

  const filteredBroadcasts = broadcasts.filter(b => 
    filterStatus === 'all' || b.status === filterStatus
  );

  const statusConfig = {
    draft: { label: 'แบบร่าง', color: 'badge-warning', icon: FiClock },
    scheduled: { label: 'รอส่ง', color: 'badge-info', icon: FiCalendar },
    sending: { label: 'กำลังส่ง', color: 'badge-warning', icon: FiSend },
    completed: { label: 'สำเร็จ', color: 'badge-success', icon: FiCheckCircle },
    failed: { label: 'ล้มเหลว', color: 'badge-danger', icon: FiXCircle }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiMessageCircle className="text-line-green" />
            Broadcast
          </h1>
          <p className="text-gray-500 mt-1">ส่งข้อความถึงผู้ติดตามทั้งหมด</p>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="btn btn-primary gap-2"
        >
          <FiSend className="w-5 h-5" />
          สร้าง Broadcast
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiMessageCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{broadcasts.length}</p>
              <p className="text-sm text-gray-500">ทั้งหมด</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <FiCheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {broadcasts.filter(b => b.status === 'completed').length}
              </p>
              <p className="text-sm text-gray-500">สำเร็จ</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <FiClock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {broadcasts.filter(b => b.status === 'scheduled').length}
              </p>
              <p className="text-sm text-gray-500">รอส่ง</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FiUsers className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {broadcasts.reduce((sum, b) => sum + b.sent_count, 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">ส่งแล้ว</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center gap-4">
          <FiFilter className="text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input w-48"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="completed">สำเร็จ</option>
            <option value="scheduled">รอส่ง</option>
            <option value="sending">กำลังส่ง</option>
            <option value="failed">ล้มเหลว</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner w-8 h-8 mx-auto mb-4" />
            <p className="text-gray-500">กำลังโหลด...</p>
          </div>
        ) : filteredBroadcasts.length === 0 ? (
          <div className="p-8 text-center">
            <FiMessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">ยังไม่มี Broadcast</p>
            <button
              onClick={() => setShowCompose(true)}
              className="btn btn-primary mt-4"
            >
              <FiSend className="w-4 h-4 mr-2" />
              สร้าง Broadcast แรก
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredBroadcasts.map(broadcast => {
              const status = statusConfig[broadcast.status];
              const StatusIcon = status.icon;
              
              return (
                <div key={broadcast.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="badge badge-info">{broadcast.channel_name}</span>
                        <span className={`badge ${status.color} flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>
                      <p className="text-gray-900 line-clamp-2">{broadcast.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FiUsers className="w-4 h-4" />
                          {broadcast.sent_count.toLocaleString()} / {broadcast.target_count.toLocaleString()}
                        </span>
                        {broadcast.sent_at && (
                          <span className="flex items-center gap-1">
                            <FiClock className="w-4 h-4" />
                            {new Date(broadcast.sent_at).toLocaleString('th-TH')}
                          </span>
                        )}
                        {broadcast.scheduled_at && broadcast.status === 'scheduled' && (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <FiCalendar className="w-4 h-4" />
                            {new Date(broadcast.scheduled_at).toLocaleString('th-TH')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(broadcast.id)}
                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">สร้าง Broadcast</h2>
              <button
                onClick={() => {
                  setShowCompose(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiXCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSend} className="p-6 space-y-4">
              {/* Channel Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เลือก LINE OA <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.channel_id}
                  onChange={(e) => setForm({ ...form, channel_id: e.target.value })}
                  className="input w-full"
                  required
                >
                  <option value="">-- เลือก Channel --</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name} ({ch.followers_count?.toLocaleString() || 0} followers)
                    </option>
                  ))}
                </select>
              </div>

              {/* Message Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ประเภทข้อความ
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="message_type"
                      value="text"
                      checked={form.message_type === 'text'}
                      onChange={(e) => setForm({ ...form, message_type: 'text' })}
                      className="text-line-green"
                    />
                    <FiMessageCircle className="w-4 h-4" />
                    ข้อความ
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="message_type"
                      value="image"
                      checked={form.message_type === 'image'}
                      onChange={(e) => setForm({ ...form, message_type: 'image' })}
                      className="text-line-green"
                    />
                    <FiImage className="w-4 h-4" />
                    รูปภาพ
                  </label>
                </div>
              </div>

              {/* Content */}
              {form.message_type === 'text' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ข้อความ <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    className="input w-full"
                    rows={5}
                    placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
                    required
                    maxLength={5000}
                  />
                  <p className="text-xs text-gray-500 mt-1 text-right">
                    {form.content.length}/5000
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL รูปภาพ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    className="input w-full"
                    placeholder="https://example.com/image.jpg"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    รองรับ JPEG, PNG ขนาดไม่เกิน 10MB
                  </p>
                </div>
              )}

              {/* Target */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  กลุ่มเป้าหมาย
                </label>
                <select
                  value={form.target_type}
                  onChange={(e) => setForm({ ...form, target_type: e.target.value as any })}
                  className="input w-full"
                >
                  <option value="all">ผู้ติดตามทั้งหมด</option>
                </select>
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ตั้งเวลาส่ง (ไม่บังคับ)
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  className="input w-full"
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  หากไม่ระบุจะส่งทันที
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCompose(false);
                    resetForm();
                  }}
                  className="btn btn-secondary flex-1"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="btn btn-primary flex-1 gap-2"
                >
                  <FiSend className="w-4 h-4" />
                  {sending ? 'กำลังส่ง...' : (form.scheduled_at ? 'ตั้งเวลาส่ง' : 'ส่งทันที')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
