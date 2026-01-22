'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  FiZap, FiPlus, FiEdit2, FiTrash2, FiSearch, FiX,
  FiMessageSquare, FiCheck, FiCode, FiEye, FiAlertCircle,
  FiCheckCircle, FiCopy
} from 'react-icons/fi';
import Swal from 'sweetalert2';
import { FlexMessageRenderer } from '@/components/FlexMessageRenderer';

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
  flex_content?: any;
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

// Validate Flex JSON (รองรับรูปแบบจาก LINE Flex Simulator)
const validateFlexJson = (json: string): { valid: boolean; error: string; parsed?: any } => {
  if (!json.trim()) {
    return { valid: false, error: 'กรุณาใส่ Flex Message JSON' };
  }

  try {
    const parsed = JSON.parse(json);
    
    // รองรับรูปแบบจาก LINE Flex Simulator (ไม่มี type: "flex")
    if (parsed.type === 'bubble' || parsed.type === 'carousel') {
      return { valid: true, error: '', parsed };
    }
    
    // รองรับรูปแบบเต็ม (มี type: "flex")
    if (parsed.type === 'flex') {
      if (!parsed.altText) {
        return { valid: false, error: 'ต้องมี "altText" สำหรับรูปแบบ type: "flex"' };
      }
      if (!parsed.contents) {
        return { valid: false, error: 'ต้องมี "contents" สำหรับรูปแบบ type: "flex"' };
      }
      return { valid: true, error: '', parsed };
    }
    
    return { valid: false, error: 'JSON ต้องมี type เป็น "bubble", "carousel" หรือ "flex"' };
  } catch (e) {
    return { valid: false, error: 'JSON format ไม่ถูกต้อง' };
  }
};

// Flex Preview Modal Component
const FlexPreviewModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  flexJson: string;
  altText: string;
}> = ({ isOpen, onClose, flexJson, altText }) => {
  if (!isOpen) return null;

  const validation = validateFlexJson(flexJson);
  let flexContent = null;
  
  if (validation.valid && validation.parsed) {
    if (validation.parsed.type === 'bubble' || validation.parsed.type === 'carousel') {
      flexContent = validation.parsed;
    } else if (validation.parsed.type === 'flex' && validation.parsed.contents) {
      flexContent = validation.parsed.contents;
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-fadeIn">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">ตัวอย่าง Flex Message</h3>
            <p className="text-sm text-gray-500">แสดงผลคล้ายกับใน LINE</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <FiX className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 bg-[#7494C0] min-h-[300px]">
          {/* Chat bubble style */}
          <div className="flex justify-end mb-4">
            <div className="bg-[#A8D98A] rounded-2xl rounded-tr-sm px-4 py-2 max-w-[70%]">
              <p className="text-sm">ส่ง Flex Message</p>
            </div>
          </div>
          
          {/* Flex Message Preview */}
          <div className="flex justify-start">
            <div className="max-w-[85%]">
              {validation.valid && flexContent ? (
                <FlexMessageRenderer content={flexContent} />
              ) : (
                <div className="bg-white rounded-xl p-4">
                  <p className="text-red-500 text-sm">{validation.error || 'ไม่สามารถแสดงผลได้'}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Alt Text Preview */}
          {altText && (
            <div className="mt-4 p-3 bg-white/90 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Alt Text (แสดงในการแจ้งเตือน):</p>
              <p className="text-sm text-gray-700">{altText}</p>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-100">
          <button onClick={onClose} className="btn btn-secondary w-full">
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

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
    flex_content: '',
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

    // Validate flex content if type is flex
    if (form.message_type === 'flex') {
      const validation = validateFlexJson(form.flex_content);
      if (!validation.valid) {
        Swal.fire({
          icon: 'error',
          title: 'Flex Message JSON ไม่ถูกต้อง',
          text: validation.error
        });
        return;
      }
    }
    
    setSaving(true);

    try {
      const url = editingReply 
        ? `/api/quick-replies/${editingReply.id}`
        : '/api/quick-replies';

      // Prepare data
      const bodyData: any = {
        title: form.title,
        shortcut: form.shortcut || null,
        message_type: form.message_type,
        content: form.message_type === 'flex' ? (form.content || 'Flex Message') : form.content,
        channel_id: form.channel_id,
        media_url: form.media_url || null
      };

      // Add flex_content if type is flex
      if (form.message_type === 'flex') {
        try {
          bodyData.flex_content = JSON.parse(form.flex_content);
        } catch (e) {
          bodyData.flex_content = null;
        }
      } else {
        bodyData.flex_content = null;
      }
      
      const res = await fetch(url, {
        method: editingReply ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
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
      flex_content: reply.flex_content ? JSON.stringify(reply.flex_content, null, 2) : '',
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
      flex_content: '',
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
        setSelectedIndex(prev => Math.min(prev + 1, filteredReplies.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredReplies[selectedIndex]) {
          handleSelect(filteredReplies[selectedIndex]);
        }
        break;
      case 'Escape':
        if (onClose) onClose();
        break;
    }
  }, [filteredReplies, selectedIndex, onClose]);

  // Compact mode (for inbox)
  if (compact) {
    return (
      <div 
        className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Search + Add Button */}
        <div className="p-2 border-b border-gray-100 flex items-center gap-2">
          <div className="relative flex-1">
            <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="ค้นหาข้อความ..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-line-green"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex-shrink-0 p-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg"
            title="เพิ่มข้อความตอบกลับ"
          >
            <FiPlus className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="spinner w-5 h-5 mx-auto" />
            </div>
          ) : filteredReplies.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {search ? 'ไม่พบข้อความตอบกลับ' : (
                <div>
                  <p className="mb-2">ยังไม่มีข้อความตอบกลับ</p>
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="text-green-600 hover:text-green-700 text-sm font-medium"
                  >
                    + เพิ่มข้อความแรก
                  </button>
                </div>
              )}
            </div>
          ) : (
            filteredReplies.map((reply, index) => (
              <div
                key={reply.id}
                onClick={() => handleSelect(reply)}
                className={`
                  px-3 py-2 border-b border-gray-50 last:border-0 group cursor-pointer
                  ${index === selectedIndex ? 'bg-green-50' : 'hover:bg-gray-50'}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {reply.message_type === 'flex' ? (
                      <FiCode className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    ) : (
                      <FiMessageSquare className="w-4 h-4 text-line-green flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm text-gray-900 truncate">{reply.title}</span>
                    {reply.shortcut && (
                      <code className="text-xs bg-gray-100 px-1 rounded text-gray-500">/{reply.shortcut}</code>
                    )}
                  </div>
                  {/* Edit & Delete Buttons */}
                  <div 
                    className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleEdit(reply, e)}
                      className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                      title="แก้ไข"
                    >
                      <FiEdit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(reply, e)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                      title="ลบ"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5 ml-6">
                  {reply.message_type === 'flex' ? '[Flex Message]' : reply.content}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Form Modal - ใช้ร่วมกัน */}
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

  // Full mode
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FiZap className="w-6 h-6 text-yellow-500" />
          <h1 className="text-xl font-bold text-gray-900">ข้อความตอบกลับด่วน</h1>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn btn-primary"
        >
          <FiPlus className="w-4 h-4 mr-2" />
          เพิ่มข้อความ
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="ค้นหาข้อความตอบกลับ..."
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
                  {reply.message_type === 'flex' ? (
                    <FiCode className="w-5 h-5 text-purple-500" />
                  ) : (
                    <FiMessageSquare className="w-5 h-5 text-line-green" />
                  )}
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
              <div className="mb-2 flex items-center gap-2">
                <span className="tag bg-green-100 text-green-700 text-xs">
                  {reply.channel_name || 'Unknown Channel'}
                </span>
                {reply.message_type === 'flex' && (
                  <span className="tag bg-purple-100 text-purple-700 text-xs">
                    Flex
                  </span>
                )}
              </div>
              
              {/* Shortcut */}
              {reply.shortcut && (
                <div className="text-xs text-gray-500 mb-2">
                  ทางลัด: <code className="bg-gray-100 px-1 rounded">/{reply.shortcut}</code>
                </div>
              )}
              
              {/* Content Preview */}
              <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                {reply.message_type === 'flex' ? '[Flex Message]' : reply.content}
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
  const [showPreview, setShowPreview] = useState(false);
  const [flexValidation, setFlexValidation] = useState<{ valid: boolean; error: string }>({ valid: true, error: '' });

  // Validate flex content on change
  useEffect(() => {
    if (form.message_type === 'flex' && form.flex_content) {
      const validation = validateFlexJson(form.flex_content);
      setFlexValidation({ valid: validation.valid, error: validation.error });
    } else {
      setFlexValidation({ valid: true, error: '' });
    }
  }, [form.flex_content, form.message_type]);

  const handleFlexContentChange = (value: string) => {
    setForm({ ...form, flex_content: value });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({
      icon: 'success',
      title: 'คัดลอกแล้ว',
      timer: 1000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ประเภทข้อความ
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, message_type: 'text' })}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  form.message_type === 'text' 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FiMessageSquare className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">ข้อความ</span>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, message_type: 'image' })}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  form.message_type === 'image' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FiZap className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">รูปภาพ</span>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, message_type: 'flex' })}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  form.message_type === 'flex' 
                    ? 'border-purple-500 bg-purple-50 text-purple-700' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FiCode className="w-5 h-5 mx-auto mb-1" />
                <span className="text-sm font-medium">Flex Message</span>
              </button>
            </div>
          </div>

          {/* Content based on message type */}
          {form.message_type === 'text' && (
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
          )}

          {form.message_type === 'image' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ข้อความ (alt text) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="input w-full"
                  placeholder="คำอธิบายรูปภาพ"
                  required
                />
              </div>
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
            </>
          )}

          {form.message_type === 'flex' && (
            <div className="space-y-4">
              {/* Alt Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alt Text (ข้อความแจ้งเตือน) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="input w-full"
                  placeholder="ข้อความที่แสดงในการแจ้งเตือน"
                  required
                />
              </div>

              {/* Flex JSON Editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Flex Message JSON <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {form.flex_content && (
                      <>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(form.flex_content)}
                          className="text-xs flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-gray-700"
                        >
                          <FiCopy className="w-3 h-3" />
                          คัดลอก
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPreview(true)}
                          className="text-xs flex items-center gap-1 px-2 py-1 text-purple-500 hover:text-purple-700"
                        >
                          <FiEye className="w-3 h-3" />
                          ดูตัวอย่าง
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <textarea
                  value={form.flex_content}
                  onChange={(e) => handleFlexContentChange(e.target.value)}
                  className={`input w-full font-mono text-sm ${
                    form.flex_content && !flexValidation.valid 
                      ? 'border-red-300 focus:ring-red-500' 
                      : ''
                  }`}
                  rows={12}
                  placeholder='{"type": "bubble", "body": {...}}'
                  required
                />

                {/* Validation Status */}
                {form.flex_content && (
                  <div className={`flex items-center gap-2 mt-2 text-sm ${
                    flexValidation.valid ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {flexValidation.valid ? (
                      <>
                        <FiCheckCircle className="w-4 h-4" />
                        <span>JSON ถูกต้อง</span>
                      </>
                    ) : (
                      <>
                        <FiAlertCircle className="w-4 h-4" />
                        <span>{flexValidation.error}</span>
                      </>
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  รองรับรูปแบบจาก LINE Flex Simulator (type: "bubble" หรือ "carousel") หรือรูปแบบเต็ม (type: "flex")
                </p>
              </div>
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
              disabled={saving || (form.message_type === 'flex' && !flexValidation.valid)}
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

        {/* Flex Preview Modal */}
        <FlexPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          flexJson={form.flex_content}
          altText={form.content}
        />
      </div>
    </div>
  );
}