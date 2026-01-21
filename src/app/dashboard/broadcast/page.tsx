'use client';

import { useEffect, useState } from 'react';
import { 
  FiMessageCircle, FiSend, FiUsers, FiRadio, FiImage,
  FiClock, FiCheckCircle, FiXCircle, FiTrash2,
  FiFilter, FiCalendar, FiAlertTriangle, FiInfo,
  FiDollarSign, FiZap, FiCode, FiHash
} from 'react-icons/fi';
import Swal from 'sweetalert2';

interface Broadcast {
  id: string;
  channel_id: string;
  channel_name: string;
  broadcast_type: 'official' | 'push';
  message_type: 'text' | 'image' | 'flex';
  content: string;
  target_count: number;
  sent_count: number;
  failed_count: number;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

interface Channel {
  id: string;
  channel_name: string;
  followers_count?: number;
}

// ฟังก์ชันแสดงเวลาแบบ Asia/Bangkok
function formatThaiDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function BroadcastPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [userCount, setUserCount] = useState<number>(0);
  const [jsonError, setJsonError] = useState<string>('');
  
  const [form, setForm] = useState({
    channel_id: '',
    broadcast_type: 'push' as 'official' | 'push',
    message_type: 'text' as 'text' | 'image' | 'flex',
    content: '',
    image_url: '',
    flex_json: '',
    limit: 0, // 0 = ส่งทั้งหมด
    delay_ms: 100
  });

  useEffect(() => {
    fetchBroadcasts();
    fetchChannels();
  }, []);

  useEffect(() => {
    if (form.channel_id) {
      fetchUserCount(form.channel_id);
    } else {
      setUserCount(0);
    }
  }, [form.channel_id]);

  // Validate Flex JSON
  useEffect(() => {
    if (form.message_type === 'flex' && form.flex_json) {
      try {
        const parsed = JSON.parse(form.flex_json);
        if (!parsed.type || parsed.type !== 'flex') {
          setJsonError('JSON ต้องมี "type": "flex"');
        } else if (!parsed.altText) {
          setJsonError('JSON ต้องมี "altText"');
        } else if (!parsed.contents) {
          setJsonError('JSON ต้องมี "contents"');
        } else {
          setJsonError('');
        }
      } catch (e) {
        setJsonError('JSON ไม่ถูกต้อง');
      }
    } else {
      setJsonError('');
    }
  }, [form.flex_json, form.message_type]);

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

  const fetchUserCount = async (channelId: string) => {
    try {
      const res = await fetch(`/api/broadcast/user-count?channel_id=${channelId}`);
      const data = await res.json();
      if (data.success) {
        setUserCount(data.data.count);
      }
    } catch (error) {
      console.error('Error fetching user count:', error);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.channel_id) {
      Swal.fire({ icon: 'warning', title: 'กรุณาเลือก Channel' });
      return;
    }

    if (form.message_type === 'text' && !form.content.trim()) {
      Swal.fire({ icon: 'warning', title: 'กรุณาใส่ข้อความ' });
      return;
    }

    if (form.message_type === 'image' && !form.image_url.trim()) {
      Swal.fire({ icon: 'warning', title: 'กรุณาใส่ URL รูปภาพ' });
      return;
    }

    if (form.message_type === 'flex') {
      if (!form.flex_json.trim()) {
        Swal.fire({ icon: 'warning', title: 'กรุณาใส่ Flex JSON' });
        return;
      }
      if (jsonError) {
        Swal.fire({ icon: 'warning', title: 'Flex JSON ไม่ถูกต้อง', text: jsonError });
        return;
      }
    }

    const channel = channels.find(c => c.id === form.channel_id);
    const maxCount = form.broadcast_type === 'official' 
      ? channel?.followers_count || 0 
      : userCount;
    const targetCount = form.limit > 0 ? Math.min(form.limit, maxCount) : maxCount;
    
    const result = await Swal.fire({
      title: 'ยืนยันการส่ง Broadcast',
      html: `
        <div class="text-left space-y-2">
          <p><strong>Channel:</strong> ${channel?.channel_name}</p>
          <p><strong>ประเภท:</strong> ${form.broadcast_type === 'official' ? '📢 Broadcast ปกติ' : '🚀 Push Broadcast (ฟรี)'}</p>
          <p><strong>ข้อความ:</strong> ${form.message_type === 'text' ? 'ข้อความ' : form.message_type === 'image' ? 'รูปภาพ' : 'Flex Message'}</p>
          <p><strong>จำนวนเป้าหมาย:</strong> ${targetCount.toLocaleString()} / ${maxCount.toLocaleString()} คน</p>
          ${form.broadcast_type === 'push' ? `
            <div class="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <p class="text-green-700">✅ <strong>ฟรี!</strong> ไม่เสียค่าส่ง</p>
              <p class="text-green-600 mt-1">ส่งเรียงตามวันที่ทักมา (คนแรก → คนที่ ${targetCount.toLocaleString()})</p>
            </div>
          ` : `
            <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <p class="text-blue-700">💰 ใช้โควต้า LINE OA</p>
            </div>
          `}
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#06C755',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ส่งเลย',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      setSending(true);
      
      Swal.fire({
        title: 'กำลังส่ง Broadcast...',
        html: `<div class="text-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div><p>กำลังส่งไปยัง ${targetCount.toLocaleString()} คน</p></div>`,
        allowOutsideClick: false,
        showConfirmButton: false
      });

      try {
        let content = form.content;
        if (form.message_type === 'image') content = form.image_url;
        if (form.message_type === 'flex') content = form.flex_json;

        const res = await fetch('/api/broadcast/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel_id: form.channel_id,
            broadcast_type: form.broadcast_type,
            message_type: form.message_type,
            content: content,
            limit: form.limit > 0 ? form.limit : 0,
            delay_ms: form.delay_ms
          })
        });

        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'ส่ง Broadcast สำเร็จ!',
            html: `
              <div class="text-left">
                <p class="text-green-600">✅ ส่งสำเร็จ: ${data.data.sent_count.toLocaleString()} คน</p>
                ${data.data.failed_count > 0 ? `<p class="text-red-600">❌ ล้มเหลว: ${data.data.failed_count.toLocaleString()} คน</p>` : ''}
              </div>
            `,
            timer: 3000,
            showConfirmButton: false
          });
          setShowCompose(false);
          resetForm();
          fetchBroadcasts();
        } else {
          throw new Error(data.message || data.error);
        }
      } catch (error: any) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: error.message });
      } finally {
        setSending(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
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
          Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false });
          fetchBroadcasts();
        }
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด' });
      }
    }
  };

  const resetForm = () => {
    setForm({
      channel_id: '',
      broadcast_type: 'push',
      message_type: 'text',
      content: '',
      image_url: '',
      flex_json: '',
      limit: 0,
      delay_ms: 100
    });
    setJsonError('');
  };

  const filteredBroadcasts = broadcasts.filter(b => 
    filterStatus === 'all' || b.status === filterStatus
  );

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    draft: { label: 'แบบร่าง', color: 'badge-gray', icon: FiClock },
    scheduled: { label: 'ตั้งเวลาไว้', color: 'badge-yellow', icon: FiCalendar },
    sending: { label: 'กำลังส่ง', color: 'badge-blue', icon: FiSend },
    completed: { label: 'สำเร็จ', color: 'badge-green', icon: FiCheckCircle },
    failed: { label: 'ล้มเหลว', color: 'badge-red', icon: FiXCircle }
  };

  const broadcastTypeConfig: Record<string, { label: string; color: string; icon: any }> = {
    official: { label: 'Broadcast', color: 'bg-blue-100 text-blue-700', icon: FiDollarSign },
    push: { label: 'Push (ฟรี)', color: 'bg-green-100 text-green-700', icon: FiZap }
  };

  const messageTypeConfig: Record<string, { label: string; color: string }> = {
    text: { label: 'ข้อความ', color: 'bg-gray-100 text-gray-700' },
    image: { label: 'รูปภาพ', color: 'bg-purple-100 text-purple-700' },
    flex: { label: 'Flex', color: 'bg-orange-100 text-orange-700' }
  };

  // Sample Flex JSON
  const sampleFlexJson = `{
  "type": "flex",
  "altText": "ข้อความโปรโมชั่น",
  "contents": {
    "type": "bubble",
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": "🎉 โปรโมชั่นพิเศษ!",
          "weight": "bold",
          "size": "xl"
        },
        {
          "type": "text",
          "text": "รายละเอียดโปรโมชั่น...",
          "margin": "md"
        }
      ]
    }
  }
}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner w-8 h-8 border-line-green border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcast</h1>
          <p className="text-gray-500">ส่งข้อความไปยังผู้ติดตาม</p>
        </div>
        <button onClick={() => setShowCompose(true)} className="btn btn-primary gap-2">
          <FiSend className="w-4 h-4" />
          สร้าง Broadcast
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <FiZap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-800">🚀 Push Broadcast (แนะนำ)</h3>
              <p className="text-sm text-green-600 mt-1">
                <strong>ฟรี 100%!</strong> ส่งไปหาคนที่เคยทักมาหา Channel<br/>
                <span className="text-green-500">• ไม่เสียค่าส่ง • รองรับ Flex Message</span>
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiDollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-800">📢 Broadcast ปกติ</h3>
              <p className="text-sm text-blue-600 mt-1">
                ส่งถึงทุกคนที่ Follow (รวมคนที่ไม่ทักมา)<br/>
                <span className="text-blue-500">• ต้องซื้อ Package รายเดือน</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <FiFilter className="w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input py-2"
            >
              <option value="all">ทั้งหมด</option>
              <option value="completed">สำเร็จ</option>
              <option value="sending">กำลังส่ง</option>
              <option value="failed">ล้มเหลว</option>
            </select>
          </div>
        </div>

        {/* Broadcast List */}
        {filteredBroadcasts.length === 0 ? (
          <div className="p-12 text-center">
            <FiMessageCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">ยังไม่มี Broadcast</p>
            <button onClick={() => setShowCompose(true)} className="btn btn-primary mt-4">
              <FiSend className="w-4 h-4 mr-2" />
              สร้าง Broadcast แรก
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredBroadcasts.map(broadcast => {
              const status = statusConfig[broadcast.status] || statusConfig.draft;
              const bcType = broadcastTypeConfig[broadcast.broadcast_type] || broadcastTypeConfig.push;
              const msgType = messageTypeConfig[broadcast.message_type] || messageTypeConfig.text;
              const StatusIcon = status.icon;
              const TypeIcon = bcType.icon;
              
              return (
                <div key={broadcast.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="badge badge-info">{broadcast.channel_name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${bcType.color}`}>
                          <TypeIcon className="w-3 h-3" />
                          {bcType.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${msgType.color}`}>
                          {msgType.label}
                        </span>
                        <span className={`badge ${status.color} flex items-center gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>
                      <p className="text-gray-900 line-clamp-2">
                        {broadcast.message_type === 'flex' ? '[Flex Message]' : broadcast.content}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FiUsers className="w-4 h-4" />
                          {broadcast.sent_count.toLocaleString()} / {broadcast.target_count.toLocaleString()}
                        </span>
                        {broadcast.sent_at && (
                          <span className="flex items-center gap-1">
                            <FiClock className="w-4 h-4" />
                            {formatThaiDateTime(broadcast.sent_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(broadcast.id)}
                      className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
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
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">สร้าง Broadcast</h2>
              <button onClick={() => { setShowCompose(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
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
                    <option key={ch.id} value={ch.id}>{ch.channel_name}</option>
                  ))}
                </select>
              </div>

              {/* Broadcast Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ประเภท Broadcast <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, broadcast_type: 'push' })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.broadcast_type === 'push' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FiZap className={`w-5 h-5 ${form.broadcast_type === 'push' ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className={`font-semibold ${form.broadcast_type === 'push' ? 'text-green-700' : 'text-gray-700'}`}>
                        Push Broadcast
                      </span>
                      <span className="px-1.5 py-0.5 bg-green-500 text-white text-xs rounded">ฟรี!</span>
                    </div>
                    <p className="text-xs text-gray-500">ส่งเฉพาะคนที่ทักมา</p>
                    {form.channel_id && (
                      <p className="text-xs text-green-600 mt-1 font-medium">👥 ส่งได้ {userCount.toLocaleString()} คน</p>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, broadcast_type: 'official' })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.broadcast_type === 'official' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FiDollarSign className={`w-5 h-5 ${form.broadcast_type === 'official' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className={`font-semibold ${form.broadcast_type === 'official' ? 'text-blue-700' : 'text-gray-700'}`}>
                        Broadcast ปกติ
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">ใช้โควต้า LINE OA</p>
                    {form.channel_id && (
                      <p className="text-xs text-blue-600 mt-1 font-medium">
                        👥 {channels.find(c => c.id === form.channel_id)?.followers_count?.toLocaleString() || 0} คน
                      </p>
                    )}
                  </button>
                </div>
              </div>

              {/* Limit (Push only) */}
              {form.broadcast_type === 'push' && form.channel_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <FiHash className="w-4 h-4 inline mr-1" />
                    จำนวนที่ต้องการส่ง
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={form.limit || ''}
                      onChange={(e) => setForm({ ...form, limit: parseInt(e.target.value) || 0 })}
                      className="input w-32"
                      placeholder="ทั้งหมด"
                      min={0}
                      max={userCount}
                    />
                    <span className="text-sm text-gray-500">
                      / {userCount.toLocaleString()} คน
                      {form.limit > 0 && form.limit <= userCount && (
                        <span className="text-green-600 ml-2">
                          (ส่งคนที่ 1 - {form.limit.toLocaleString()})
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    เว้นว่างหรือใส่ 0 = ส่งทั้งหมด • เรียงตามวันที่ทักมา (เก่า → ใหม่)
                  </p>
                </div>
              )}

              {/* Message Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทข้อความ</label>
                <div className="flex gap-3 flex-wrap">
                  <label className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 transition-all ${
                    form.message_type === 'text' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="message_type"
                      checked={form.message_type === 'text'}
                      onChange={() => setForm({ ...form, message_type: 'text' })}
                      className="hidden"
                    />
                    <FiMessageCircle className="w-4 h-4" />
                    ข้อความ
                  </label>
                  <label className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 transition-all ${
                    form.message_type === 'image' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="message_type"
                      checked={form.message_type === 'image'}
                      onChange={() => setForm({ ...form, message_type: 'image' })}
                      className="hidden"
                    />
                    <FiImage className="w-4 h-4" />
                    รูปภาพ
                  </label>
                  <label className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 transition-all ${
                    form.message_type === 'flex' ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}>
                    <input
                      type="radio"
                      name="message_type"
                      checked={form.message_type === 'flex'}
                      onChange={() => setForm({ ...form, message_type: 'flex' })}
                      className="hidden"
                    />
                    <FiCode className="w-4 h-4" />
                    Flex Message
                  </label>
                </div>
              </div>

              {/* Content based on type */}
              {form.message_type === 'text' && (
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
                    maxLength={5000}
                  />
                  <p className="text-xs text-gray-500 mt-1 text-right">{form.content.length}/5000</p>
                </div>
              )}

              {form.message_type === 'image' && (
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
                  />
                  <p className="text-xs text-gray-500 mt-1">รองรับ JPEG, PNG ขนาดไม่เกิน 10MB</p>
                </div>
              )}

              {form.message_type === 'flex' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Flex Message JSON <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, flex_json: sampleFlexJson })}
                      className="text-xs text-green-600 hover:text-green-700"
                    >
                      ใส่ตัวอย่าง
                    </button>
                  </div>
                  <textarea
                    value={form.flex_json}
                    onChange={(e) => setForm({ ...form, flex_json: e.target.value })}
                    className={`input w-full font-mono text-sm ${jsonError ? 'border-red-500' : ''}`}
                    rows={10}
                    placeholder='{"type": "flex", "altText": "...", "contents": {...}}'
                  />
                  {jsonError && (
                    <p className="text-xs text-red-500 mt-1">❌ {jsonError}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    สร้าง Flex Message ได้ที่{' '}
                    <a href="https://developers.line.biz/flex-simulator/" target="_blank" className="text-green-600 hover:underline">
                      LINE Flex Message Simulator
                    </a>
                  </p>
                </div>
              )}

              {/* Info Box */}
              {form.broadcast_type === 'push' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <FiAlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-amber-700 font-medium">ข้อจำกัดของ Push Broadcast</p>
                      <ul className="text-amber-600 mt-1 space-y-0.5">
                        <li>• ส่งได้เฉพาะคนที่เคยทักมาหา Channel นี้</li>
                        <li>• ไม่สามารถดึง followers ที่ไม่ทักมาได้ (LINE API ไม่รองรับ)</li>
                        <li>• ระบบส่งแบบ batch 500 คน/ครั้ง ป้องกัน rate limit</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCompose(false); resetForm(); }}
                  className="btn btn-secondary flex-1"
                >
                  ยกเลิก
                </button>
                <button type="submit" disabled={sending} className="btn btn-primary flex-1 gap-2">
                  <FiSend className="w-4 h-4" />
                  {sending ? 'กำลังส่ง...' : 'ส่งเลย'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}