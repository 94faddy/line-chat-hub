'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  FiZap, FiPlus, FiEdit2, FiTrash2, FiSearch, FiX,
  FiMessageSquare, FiCheck
} from 'react-icons/fi';
import Swal from 'sweetalert2';

interface Channel {
  id: string;
  channel_name: string;
  picture_url?: string;
}

interface QuickReply {
  id: string;
  title: string;
  shortcut?: string;
  message_type: string;
  content: string;
  media_url?: string;
  channel_id?: string;
  channel_name?: string;
  use_count: number;
  is_active: boolean;
  created_at: string;
}

interface QuickRepliesPanelProps {
  // เมื่อเลือกข้อความตอบกลับ
  onSelect?: (reply: QuickReply) => void;
  // Channel ปัจจุบัน (สำหรับ filter)
  currentChannelId?: string;
  // ปิด panel
  onClose?: () => void;
  // แสดงแบบ compact (สำหรับ inbox)
  compact?: boolean;
  // แสดงแบบ popup/modal
  asModal?: boolean;
  // ค่า search จากภายนอก (เช่นจาก shortcut /)
  externalSearch?: string;
  // เมื่อ search เปลี่ยน
  onSearchChange?: (search: string) => void;
}

export default function QuickRepliesPanel({
  onSelect,
  currentChannelId,
  onClose,
  compact = false,
  asModal = false,
  externalSearch = '',
  onSearchChange
}: QuickRepliesPanelProps) {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(externalSearch);
  const [showForm, setShowForm] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const [form, setForm] = useState({
    title: '',
    shortcut: '',
    message_type: 'text',
    content: '',
    media_url: '',
    channel_id: ''
  });

  useEffect(() => {
    setSearch(externalSearch);
  }, [externalSearch]);

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
    
    // ตรวจสอบว่าเลือก channel หรือยัง
    if (!form.channel_id) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณาเลือก LINE Channel',
        text: 'ข้อความตอบกลับต้องผูกกับ LINE Channel'
      });
      return;
    }
    
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
          channel_id: form.channel_id
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
        setShowForm(false);
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

  const handleEdit = (reply: QuickReply, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingReply(reply);
    setForm({
      title: reply.title,
      shortcut: reply.shortcut || '',
      message_type: reply.message_type,
      content: reply.content,
      media_url: reply.media_url || '',
      channel_id: reply.channel_id?.toString() || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (reply: QuickReply, e: React.MouseEvent) => {
    e.stopPropagation();
    
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
      channel_id: currentChannelId?.toString() || (channels.length > 0 ? channels[0].id.toString() : '')
    });
  };

  const handleSelect = (reply: QuickReply) => {
    if (onSelect) {
      onSelect(reply);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setSelectedIndex(0);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  // Filter quick replies
  const filteredReplies = quickReplies.filter(reply => {
    // กรองตาม channel - แสดงเฉพาะที่ตรงกับ channel ที่เลือก
    if (currentChannelId) {
      const replyChannelId = reply.channel_id?.toString();
      const currentChId = currentChannelId.toString();
      // แสดงเฉพาะที่ตรงกับ channel เท่านั้น
      if (replyChannelId !== currentChId) {
        return false;
      }
    }
    
    // กรองตามคำค้นหา
    if (search) {
      const searchLower = search.toLowerCase();
      return reply.title.toLowerCase().includes(searchLower) ||
             reply.content.toLowerCase().includes(searchLower) ||
             reply.shortcut?.toLowerCase().includes(searchLower);
    }
    return true;
  });

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (filteredReplies.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredReplies.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredReplies.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredReplies[selectedIndex]) {
          handleSelect(filteredReplies[selectedIndex]);
        }
        break;
      case 'Escape':
        if (onClose) {
          onClose();
        }
        break;
    }
  }, [filteredReplies, selectedIndex, onClose]);

  // Compact view for inbox
  if (compact) {
    return (
      <div 
        className="bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-hidden flex flex-col"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FiZap className="w-4 h-4 text-line-green" />
            <span className="font-medium text-sm text-gray-700">ข้อความตอบกลับ</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors"
              title="เพิ่มข้อความตอบกลับใหม่"
            >
              <FiPlus className="w-3.5 h-3.5" />
              <span>เพิ่ม</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded text-gray-400"
              >
                <FiX className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-gray-100">
          <div className="relative">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหา..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center">
              <div className="spinner w-6 h-6 mx-auto" />
            </div>
          ) : filteredReplies.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {search ? 'ไม่พบข้อความตอบกลับ' : 'ยังไม่มีข้อความตอบกลับ'}
            </div>
          ) : (
            <div className="py-1">
              {filteredReplies.map((reply, index) => (
                <div
                  key={reply.id}
                  onClick={() => handleSelect(reply)}
                  className={`
                    px-3 py-2 cursor-pointer flex items-start gap-2 group
                    ${index === selectedIndex ? 'bg-green-50 border-l-2 border-green-500' : 'hover:bg-gray-50'}
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {reply.title}
                      </span>
                      {reply.shortcut && (
                        <code className="text-xs bg-gray-100 text-green-600 px-1 rounded">
                          /{reply.shortcut}
                        </code>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {reply.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleEdit(reply, e)}
                      className="p-1.5 hover:bg-blue-100 rounded text-gray-400 hover:text-blue-600 transition-colors"
                      title="แก้ไข"
                    >
                      <FiEdit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(reply, e)}
                      className="p-1.5 hover:bg-red-100 rounded text-gray-400 hover:text-red-600 transition-colors"
                      title="ลบ"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer tip */}
        <div className="px-3 py-1.5 text-xs text-gray-400 border-t bg-gray-50">
          ↑↓ เลือก • Enter ใช้งาน • Esc ปิด
        </div>

        {/* Form Modal */}
        {showForm && (
          <QuickReplyFormModal
            form={form}
            setForm={setForm}
            channels={channels}
            editingReply={editingReply}
            saving={saving}
            onSubmit={handleSubmit}
            onClose={() => {
              setShowForm(false);
              resetForm();
            }}
          />
        )}
      </div>
    );
  }

  // Full view (standalone page)
  return (
    <div className={asModal ? '' : 'p-6'}>
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
            setShowForm(true);
          }}
          className="btn btn-primary gap-2"
        >
          <FiPlus className="w-5 h-5" />
          เพิ่มข้อความตอบกลับ
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาข้อความตอบกลับ..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="input pl-10 w-full"
          />
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
            onClick={() => setShowForm(true)}
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
              onClick={() => onSelect && handleSelect(reply)}
              className={`
                bg-white rounded-xl shadow-sm border border-gray-100 p-4 
                hover:shadow-md transition-shadow
                ${onSelect ? 'cursor-pointer' : ''}
              `}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FiMessageSquare className="w-5 h-5 text-line-green" />
                  <span className="font-semibold text-gray-900">{reply.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleEdit(reply, e)}
                    className="p-1.5 text-gray-400 hover:text-line-green hover:bg-gray-100 rounded"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(reply, e)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Channel Badge */}
              <div className="mb-2">
                <span className="tag bg-green-100 text-green-700 text-xs">
                  {reply.channel_name || 'Unknown Channel'}
                </span>
              </div>
              
              {/* Shortcut */}
              {reply.shortcut && (
                <div className="text-xs text-gray-500 mb-2">
                  ทางลัด: <code className="bg-gray-100 px-1 rounded">/{reply.shortcut}</code>
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

      {/* Form Modal */}
      {showForm && (
        <QuickReplyFormModal
          form={form}
          setForm={setForm}
          channels={channels}
          editingReply={editingReply}
          saving={saving}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            resetForm();
          }}
        />
      )}
    </div>
  );
}

// Form Modal Component
function QuickReplyFormModal({
  form,
  setForm,
  channels,
  editingReply,
  saving,
  onSubmit,
  onClose
}: {
  form: any;
  setForm: (form: any) => void;
  channels: Channel[];
  editingReply: QuickReply | null;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg animate-fadeIn max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {editingReply ? 'แก้ไขข้อความตอบกลับ' : 'เพิ่มข้อความตอบกลับ'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
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
              LINE Channel <span className="text-red-500">*</span>
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
            <p className="text-xs text-gray-500 mt-1">ข้อความตอบกลับจะใช้ได้เฉพาะใน Channel ที่เลือก</p>
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
              placeholder="เช่น hi, price"
              maxLength={50}
            />
            <p className="text-xs text-gray-500 mt-1">พิมพ์ /{form.shortcut || 'shortcut'} เพื่อเรียกใช้งานอย่างรวดเร็ว</p>
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
              onClick={onClose}
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
                <span className="flex items-center justify-center gap-2">
                  <div className="spinner w-4 h-4 border-white border-t-transparent" />
                  กำลังบันทึก...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <FiCheck className="w-4 h-4" />
                  {editingReply ? 'อัปเดต' : 'เพิ่ม'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}