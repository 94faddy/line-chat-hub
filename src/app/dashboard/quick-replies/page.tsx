'use client';

import { useEffect, useState } from 'react';
import { 
  FiZap, FiPlus, FiEdit2, FiTrash2, FiSearch, FiX,
  FiMessageSquare, FiGlobe
} from 'react-icons/fi';
import Swal from 'sweetalert2';

interface Channel {
  id: number;
  channel_name: string;
  picture_url?: string;
}

interface QuickReply {
  id: number;
  title: string;
  shortcut?: string;
  message_type: string;
  content: string;
  media_url?: string;
  channel_id?: number;
  channel_name?: string;
  use_count: number;
  is_active: boolean;
  created_at: string;
}

export default function QuickRepliesPage() {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    title: '',
    shortcut: '',
    message_type: 'text',
    content: '',
    media_url: '',
    channel_id: ''
  });

  useEffect(() => {
    fetchChannels();
    fetchQuickReplies();
  }, []);

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

  const fetchQuickReplies = async () => {
    try {
      const res = await fetch('/api/quick-replies');
      const data = await res.json();
      if (data.success) {
        setQuickReplies(data.data);
      }
    } catch (error) {
      console.error('Error fetching quick replies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingReply 
        ? `/api/quick-replies/${editingReply.id}`
        : '/api/quick-replies';
      
      const res = await fetch(url, {
        method: editingReply ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          channel_id: form.channel_id || null
        })
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: editingReply ? 'อัปเดตสำเร็จ' : 'เพิ่มสำเร็จ',
          timer: 1500,
          showConfirmButton: false
        });
        setShowModal(false);
        resetForm();
        fetchQuickReplies();
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error.message || 'ไม่สามารถบันทึกได้'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (reply: QuickReply) => {
    setEditingReply(reply);
    setForm({
      title: reply.title,
      shortcut: reply.shortcut || '',
      message_type: reply.message_type,
      content: reply.content,
      media_url: reply.media_url || '',
      channel_id: reply.channel_id?.toString() || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (reply: QuickReply) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ',
      html: `คุณต้องการลบ "<strong>${reply.title}</strong>" หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/quick-replies/${reply.id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'ลบสำเร็จ',
            timer: 1500,
            showConfirmButton: false
          });
          fetchQuickReplies();
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
    setEditingReply(null);
    setForm({
      title: '',
      shortcut: '',
      message_type: 'text',
      content: '',
      media_url: '',
      channel_id: ''
    });
  };

  const filteredReplies = quickReplies.filter(reply => {
    if (filterChannel !== 'all') {
      if (filterChannel === 'global') {
        if (reply.channel_id !== null) return false;
      } else {
        if (reply.channel_id?.toString() !== filterChannel) return false;
      }
    }
    if (search) {
      const searchLower = search.toLowerCase();
      return reply.title.toLowerCase().includes(searchLower) ||
             reply.content.toLowerCase().includes(searchLower) ||
             reply.shortcut?.toLowerCase().includes(searchLower);
    }
    return true;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiZap className="text-line-green" />
            ข้อความตอบกลับ
          </h1>
          <p className="text-gray-500 mt-1">จัดการข้อความสำหรับตอบกลับลูกค้าแยกตาม LINE Channel</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn btn-primary gap-2"
        >
          <FiPlus className="w-5 h-5" />
          เพิ่มข้อความตอบกลับ
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหา..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="input w-full sm:w-48"
          >
            <option value="all">ทุก Channel</option>
            <option value="global">🌐 ใช้ได้ทุก Channel</option>
            {channels.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.channel_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Replies List */}
      {loading ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      ) : filteredReplies.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <FiZap className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">ยังไม่มีข้อความตอบกลับ</p>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary mt-4"
          >
            <FiPlus className="w-4 h-4 mr-2" />
            เพิ่มข้อความแรก
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReplies.map(reply => (
            <div 
              key={reply.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FiMessageSquare className="w-5 h-5 text-line-green" />
                  <span className="font-semibold text-gray-900">{reply.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(reply)}
                    className="p-1.5 text-gray-400 hover:text-line-green hover:bg-gray-100 rounded"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(reply)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Channel Badge */}
              <div className="mb-2">
                {reply.channel_id ? (
                  <span className="tag bg-green-100 text-green-700 text-xs">
                    {reply.channel_name}
                  </span>
                ) : (
                  <span className="tag bg-blue-100 text-blue-700 text-xs flex items-center gap-1">
                    <FiGlobe className="w-3 h-3" />
                    ใช้ได้ทุก Channel
                  </span>
                )}
              </div>
              
              {/* Shortcut */}
              {reply.shortcut && (
                <div className="text-xs text-gray-500 mb-2">
                  ทางลัด: <code className="bg-gray-100 px-1 rounded">{reply.shortcut}</code>
                </div>
              )}
              
              {/* Content Preview */}
              <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                {reply.content}
              </p>
              
              {/* Stats */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>ใช้งาน {reply.use_count} ครั้ง</span>
                <span>{reply.message_type}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingReply ? 'แก้ไขข้อความตอบกลับ' : 'เพิ่มข้อความตอบกลับ'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input w-full"
                  placeholder="เช่น ทักทาย, สอบถามราคา"
                  required
                  maxLength={100}
                />
              </div>

              {/* Channel */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LINE Channel
                </label>
                <select
                  value={form.channel_id}
                  onChange={(e) => setForm({ ...form, channel_id: e.target.value })}
                  className="input w-full"
                >
                  <option value="">🌐 ใช้ได้ทุก Channel</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.channel_name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">เลือก Channel ที่จะใช้ข้อความนี้ หรือเว้นว่างเพื่อใช้กับทุก Channel</p>
              </div>

              {/* Shortcut */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ทางลัด
                </label>
                <input
                  type="text"
                  value={form.shortcut}
                  onChange={(e) => setForm({ ...form, shortcut: e.target.value })}
                  className="input w-full"
                  placeholder="เช่น /hi, /price"
                  maxLength={50}
                />
                <p className="text-xs text-gray-500 mt-1">พิมพ์ทางลัดเพื่อเรียกใช้งานอย่างรวดเร็ว</p>
              </div>

              {/* Message Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ประเภทข้อความ
                </label>
                <select
                  value={form.message_type}
                  onChange={(e) => setForm({ ...form, message_type: e.target.value })}
                  className="input w-full"
                >
                  <option value="text">ข้อความ</option>
                  <option value="image">รูปภาพ</option>
                </select>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ข้อความ <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="input w-full"
                  rows={4}
                  placeholder="พิมพ์ข้อความที่ต้องการตอบกลับ..."
                  required
                />
              </div>

              {/* Media URL (for image type) */}
              {form.message_type === 'image' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL รูปภาพ
                  </label>
                  <input
                    type="url"
                    value={form.media_url}
                    onChange={(e) => setForm({ ...form, media_url: e.target.value })}
                    className="input w-full"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
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
                  {saving ? 'กำลังบันทึก...' : (editingReply ? 'อัปเดต' : 'เพิ่ม')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
