// src/components/QuickRepliesPanel.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  FiZap, FiPlus, FiEdit2, FiTrash2, FiSearch, FiX,
  FiMessageSquare, FiCheck, FiCode, FiEye, FiAlertCircle,
  FiCheckCircle, FiCopy, FiChevronUp, FiChevronDown, FiImage,
  FiBox
} from 'react-icons/fi';
import Swal from 'sweetalert2';
import { FlexMessageRenderer } from '@/components/FlexMessageRenderer';

// ==================== Interfaces ====================

interface Channel {
  id: string;
  channel_name: string;
  picture_url?: string;
}

interface MessageBox {
  type: 'text' | 'image' | 'flex';
  content: string;
  flex_content?: any;
  media_url?: string;
}

interface QuickReply {
  id: string;
  title: string;
  shortcut?: string;
  messages: MessageBox[];
  // Legacy fields (backward compatibility)
  message_type?: string;
  content?: string;
  flex_content?: any;
  media_url?: string;
  channel_id?: string;
  channel_name?: string;
  use_count: number;
  is_active: boolean;
  sort_order?: number;
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

// ==================== Helper Functions ====================

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

// ==================== Flex Preview Modal Component ====================

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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">ตัวอย่าง Flex Message</h3>
            <p className="text-sm text-gray-500">แสดงผลคล้ายกับใน LINE</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <FiX className="w-5 h-5" />
          </button>
        </div>
        
        {/* Preview Area */}
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
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <button onClick={onClose} className="btn btn-secondary w-full">
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== Message Box Editor Component ====================

const MessageBoxEditor: React.FC<{
  box: MessageBox;
  index: number;
  totalBoxes: number;
  onChange: (index: number, box: MessageBox) => void;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}> = ({ box, index, totalBoxes, onChange, onRemove, onMoveUp, onMoveDown }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [flexValidation, setFlexValidation] = useState<{ valid: boolean; error: string }>({ valid: true, error: '' });

  // Validate flex content on change
  useEffect(() => {
    if (box.type === 'flex' && box.flex_content) {
      const jsonStr = typeof box.flex_content === 'string' 
        ? box.flex_content 
        : JSON.stringify(box.flex_content, null, 2);
      const validation = validateFlexJson(jsonStr);
      setFlexValidation({ valid: validation.valid, error: validation.error });
    } else {
      setFlexValidation({ valid: true, error: '' });
    }
  }, [box.flex_content, box.type]);

  const getFlexContentString = () => {
    if (!box.flex_content) return '';
    return typeof box.flex_content === 'string' 
      ? box.flex_content 
      : JSON.stringify(box.flex_content, null, 2);
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
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
      {/* Box Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FiBox className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Box {index + 1}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            box.type === 'text' ? 'bg-green-100 text-green-700' :
            box.type === 'image' ? 'bg-blue-100 text-blue-700' :
            'bg-purple-100 text-purple-700'
          }`}>
            {box.type === 'text' ? 'ข้อความ' : box.type === 'image' ? 'รูปภาพ' : 'Flex'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Move Up */}
          <button
            type="button"
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="เลื่อนขึ้น"
          >
            <FiChevronUp className="w-4 h-4" />
          </button>
          {/* Move Down */}
          <button
            type="button"
            onClick={() => onMoveDown(index)}
            disabled={index === totalBoxes - 1}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="เลื่อนลง"
          >
            <FiChevronDown className="w-4 h-4" />
          </button>
          {/* Remove */}
          {totalBoxes > 1 && (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="p-1 text-red-400 hover:text-red-600 ml-1"
              title="ลบ Box นี้"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Message Type Selector */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <button
          type="button"
          onClick={() => onChange(index, { ...box, type: 'text' })}
          className={`p-2 rounded-lg border-2 text-center text-xs transition-all ${
            box.type === 'text' 
              ? 'border-green-500 bg-green-50 text-green-700' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <FiMessageSquare className="w-4 h-4 mx-auto mb-1" />
          ข้อความ
        </button>
        <button
          type="button"
          onClick={() => onChange(index, { ...box, type: 'image' })}
          className={`p-2 rounded-lg border-2 text-center text-xs transition-all ${
            box.type === 'image' 
              ? 'border-blue-500 bg-blue-50 text-blue-700' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <FiImage className="w-4 h-4 mx-auto mb-1" />
          รูปภาพ
        </button>
        <button
          type="button"
          onClick={() => onChange(index, { ...box, type: 'flex' })}
          className={`p-2 rounded-lg border-2 text-center text-xs transition-all ${
            box.type === 'flex' 
              ? 'border-purple-500 bg-purple-50 text-purple-700' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <FiCode className="w-4 h-4 mx-auto mb-1" />
          Flex
        </button>
      </div>

      {/* Content based on type */}
      {box.type === 'text' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ข้อความ <span className="text-red-500">*</span>
          </label>
          <textarea
            value={box.content}
            onChange={(e) => onChange(index, { ...box, content: e.target.value })}
            className="input w-full text-sm"
            rows={3}
            placeholder="พิมพ์ข้อความที่ต้องการตอบกลับ..."
            required
          />
        </div>
      )}

      {box.type === 'image' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              คำอธิบายรูปภาพ (alt text) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={box.content}
              onChange={(e) => onChange(index, { ...box, content: e.target.value })}
              className="input w-full text-sm"
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
              value={box.media_url || ''}
              onChange={(e) => onChange(index, { ...box, media_url: e.target.value })}
              className="input w-full text-sm"
              placeholder="https://example.com/image.jpg"
            />
          </div>
          {/* Image Preview */}
          {box.media_url && (
            <div className="mt-2">
              <img 
                src={box.media_url} 
                alt="Preview" 
                className="max-h-32 rounded-lg object-contain border border-gray-200"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>
      )}

      {box.type === 'flex' && (
        <div className="space-y-3">
          {/* Alt Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alt Text (ข้อความแจ้งเตือน) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={box.content}
              onChange={(e) => onChange(index, { ...box, content: e.target.value })}
              className="input w-full text-sm"
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
                {getFlexContentString() && (
                  <>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(getFlexContentString())}
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
              value={getFlexContentString()}
              onChange={(e) => {
                let flexContent: any = e.target.value;
                try {
                  flexContent = JSON.parse(e.target.value);
                } catch {
                  // Keep as string if invalid JSON
                }
                onChange(index, { ...box, flex_content: flexContent });
              }}
              className={`input w-full text-sm font-mono ${
                getFlexContentString() && !flexValidation.valid 
                  ? 'border-red-300 focus:ring-red-500' 
                  : ''
              }`}
              rows={8}
              placeholder='{"type": "bubble", "body": {...}}'
              required
            />

            {/* Validation Status */}
            {getFlexContentString() && (
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

      {/* Flex Preview Modal */}
      <FlexPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        flexJson={getFlexContentString()}
        altText={box.content}
      />
    </div>
  );
};

// ==================== Main Component ====================

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
  const [reordering, setReordering] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    title: '',
    shortcut: '',
    channel_id: '',
    messages: [{ type: 'text' as const, content: '', flex_content: null as any, media_url: '' }]
  });

  // ==================== Effects ====================

  useEffect(() => {
    setSearch(externalSearch);
  }, [externalSearch]);

  useEffect(() => {
    fetchChannels();
    fetchQuickReplies();
  }, []);

  // ==================== API Functions ====================

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

  // ==================== Reorder Function ====================

  const handleReorder = async (replyId: string, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (reordering) return; // ป้องกันกดซ้ำ
    
    setReordering(replyId);
    
    try {
      const res = await fetch('/api/quick-replies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: replyId, direction })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // รีเฟรชข้อมูล
        await fetchQuickReplies();
      } else {
        // ถ้าอยู่บนสุด/ล่างสุดแล้ว ไม่ต้องแสดง error
        if (!data.message.includes('บนสุด') && !data.message.includes('ล่างสุด')) {
          Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: data.message,
            timer: 2000,
            showConfirmButton: false
          });
        }
      }
    } catch (error) {
      console.error('Reorder error:', error);
    } finally {
      setReordering(null);
    }
  };

  // ==================== Form Submit ====================

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

    // ตรวจสอบว่ามีอย่างน้อย 1 message
    if (form.messages.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณาเพิ่มอย่างน้อย 1 ข้อความ'
      });
      return;
    }

    // Validate all messages
    for (let i = 0; i < form.messages.length; i++) {
      const msg = form.messages[i];
      
      if (!msg.content.trim()) {
        Swal.fire({
          icon: 'error',
          title: `Box ${i + 1}: กรุณากรอกข้อความ`
        });
        return;
      }
      
      if (msg.type === 'flex') {
        const jsonStr = typeof msg.flex_content === 'string' 
          ? msg.flex_content 
          : JSON.stringify(msg.flex_content);
        const validation = validateFlexJson(jsonStr || '');
        if (!validation.valid) {
          Swal.fire({
            icon: 'error',
            title: `Box ${i + 1}: Flex Message JSON ไม่ถูกต้อง`,
            text: validation.error
          });
          return;
        }
      }
    }
    
    setSaving(true);

    try {
      const url = editingReply 
        ? `/api/quick-replies/${editingReply.id}`
        : '/api/quick-replies';

      // Prepare messages - ensure flex_content is object
      const preparedMessages = form.messages.map(msg => {
        if (msg.type === 'flex' && msg.flex_content) {
          return {
            ...msg,
            flex_content: typeof msg.flex_content === 'string' 
              ? JSON.parse(msg.flex_content) 
              : msg.flex_content
          };
        }
        return msg;
      });

      const bodyData = {
        title: form.title,
        shortcut: form.shortcut || null,
        channel_id: form.channel_id,
        messages: preparedMessages
      };
      
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

  // ==================== Edit & Delete ====================

  const handleEdit = (reply: QuickReply, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingReply(reply);
    
    // Convert to form format
    let messages = reply.messages || [];
    
    // Legacy format support
    if (messages.length === 0 && reply.content) {
      messages = [{
        type: (reply.message_type as 'text' | 'image' | 'flex') || 'text',
        content: reply.content || '',
        flex_content: reply.flex_content,
        media_url: reply.media_url || ''
      }];
    }
    
    setForm({
      title: reply.title,
      shortcut: reply.shortcut || '',
      channel_id: reply.channel_id?.toString() || '',
      messages: messages.map(m => ({
        type: m.type || 'text',
        content: m.content || '',
        flex_content: m.flex_content,
        media_url: m.media_url || ''
      }))
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

  // ==================== Helper Functions ====================

  const resetForm = () => {
    setEditingReply(null);
    setForm({
      title: '',
      shortcut: '',
      channel_id: currentChannelId?.toString() || (channels.length > 0 ? channels[0].id.toString() : ''),
      messages: [{ type: 'text', content: '', flex_content: null, media_url: '' }]
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

  // ==================== Message Box Handlers ====================

  const handleMessageChange = (index: number, box: MessageBox) => {
    const newMessages = [...form.messages];
    newMessages[index] = box;
    setForm({ ...form, messages: newMessages });
  };

  const handleAddMessage = () => {
    setForm({
      ...form,
      messages: [...form.messages, { type: 'text', content: '', flex_content: null, media_url: '' }]
    });
  };

  const handleRemoveMessage = (index: number) => {
    if (form.messages.length > 1) {
      const newMessages = form.messages.filter((_, i) => i !== index);
      setForm({ ...form, messages: newMessages });
    }
  };

  const handleMoveMessageUp = (index: number) => {
    if (index > 0) {
      const newMessages = [...form.messages];
      [newMessages[index - 1], newMessages[index]] = [newMessages[index], newMessages[index - 1]];
      setForm({ ...form, messages: newMessages });
    }
  };

  const handleMoveMessageDown = (index: number) => {
    if (index < form.messages.length - 1) {
      const newMessages = [...form.messages];
      [newMessages[index], newMessages[index + 1]] = [newMessages[index + 1], newMessages[index]];
      setForm({ ...form, messages: newMessages });
    }
  };

  // ==================== Filter ====================

  const filteredReplies = quickReplies.filter(reply => {
    // กรองตาม channel - แสดงเฉพาะที่ตรงกับ channel ที่เลือก
    if (currentChannelId) {
      const replyChannelId = reply.channel_id?.toString();
      const currentChId = currentChannelId.toString();
      if (replyChannelId !== currentChId) {
        return false;
      }
    }
    
    // กรองตามคำค้นหา
    if (search) {
      const searchLower = search.toLowerCase();
      return reply.title.toLowerCase().includes(searchLower) ||
             reply.shortcut?.toLowerCase().includes(searchLower) ||
             reply.messages?.some(m => m.content.toLowerCase().includes(searchLower));
    }
    return true;
  });

  // ==================== Keyboard Navigation ====================

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

  // ==================== Preview Text Helper ====================

  const getPreviewText = (reply: QuickReply) => {
    const messages = reply.messages || [];
    if (messages.length === 0) return reply.content || '';
    
    // แสดงประเภทแต่ละ box
    return messages.map((msg, idx) => {
      const boxNum = `Box${idx + 1}`;
      if (msg.type === 'flex') return `${boxNum}: [Flex]`;
      if (msg.type === 'image') return `${boxNum}: [รูปภาพ]`;
      return `${boxNum}: [ข้อความ]`;
    }).join(' → ');
  };

  // ==================== Render: Compact Mode ====================

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
                    {/* Icon based on message count/type */}
                    {(reply.messages?.length || 0) > 1 ? (
                      <div className="flex items-center gap-0.5 text-orange-500">
                        <FiBox className="w-4 h-4 flex-shrink-0" />
                        <span className="text-xs">{reply.messages?.length}</span>
                      </div>
                    ) : reply.messages?.[0]?.type === 'flex' ? (
                      <FiCode className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    ) : reply.messages?.[0]?.type === 'image' ? (
                      <FiImage className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    ) : (
                      <FiMessageSquare className="w-4 h-4 text-line-green flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm text-gray-900 truncate">{reply.title}</span>
                    {reply.shortcut && (
                      <code className="text-xs bg-gray-100 px-1 rounded text-gray-500">/{reply.shortcut}</code>
                    )}
                  </div>
                  {/* Action Buttons */}
                  <div 
                    className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Reorder Up */}
                    <button
                      type="button"
                      onClick={(e) => handleReorder(reply.id, 'up', e)}
                      disabled={reordering === reply.id}
                      className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                      title="เลื่อนขึ้น"
                    >
                      <FiChevronUp className="w-3.5 h-3.5" />
                    </button>
                    {/* Reorder Down */}
                    <button
                      type="button"
                      onClick={(e) => handleReorder(reply.id, 'down', e)}
                      disabled={reordering === reply.id}
                      className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                      title="เลื่อนลง"
                    >
                      <FiChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-3 bg-gray-200 mx-0.5" />
                    {/* Edit */}
                    <button
                      type="button"
                      onClick={(e) => handleEdit(reply, e)}
                      className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                      title="แก้ไข"
                    >
                      <FiEdit2 className="w-3.5 h-3.5" />
                    </button>
                    {/* Delete */}
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
                  {getPreviewText(reply)}
                </p>
              </div>
            ))
          )}
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
            onMessageChange={handleMessageChange}
            onAddMessage={handleAddMessage}
            onRemoveMessage={handleRemoveMessage}
            onMoveMessageUp={handleMoveMessageUp}
            onMoveMessageDown={handleMoveMessageDown}
          />
        )}
      </div>
    );
  }

  // ==================== Render: Full Mode ====================

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
          {filteredReplies.map((reply) => (
            <div 
              key={reply.id}
              onClick={() => onSelect && handleSelect(reply)}
              className={`
                bg-white rounded-xl shadow-sm border border-gray-100 p-4 
                hover:shadow-md transition-shadow
                ${onSelect ? 'cursor-pointer' : ''}
              `}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {/* Icon */}
                  {(reply.messages?.length || 0) > 1 ? (
                    <div className="flex items-center gap-1 text-orange-500">
                      <FiBox className="w-5 h-5" />
                      <span className="text-xs font-medium">{reply.messages?.length}</span>
                    </div>
                  ) : reply.messages?.[0]?.type === 'flex' ? (
                    <FiCode className="w-5 h-5 text-purple-500" />
                  ) : reply.messages?.[0]?.type === 'image' ? (
                    <FiImage className="w-5 h-5 text-blue-500" />
                  ) : (
                    <FiMessageSquare className="w-5 h-5 text-line-green" />
                  )}
                  <span className="font-semibold text-gray-900">{reply.title}</span>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleReorder(reply.id, 'up', e)}
                    disabled={reordering === reply.id}
                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                    title="เลื่อนขึ้น"
                  >
                    <FiChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleReorder(reply.id, 'down', e)}
                    disabled={reordering === reply.id}
                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                    title="เลื่อนลง"
                  >
                    <FiChevronDown className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-gray-200 mx-1" />
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
              
              {/* Tags */}
              <div className="mb-2 flex items-center gap-2 flex-wrap">
                <span className="tag bg-green-100 text-green-700 text-xs">
                  {reply.channel_name || 'Unknown Channel'}
                </span>
                {(reply.messages?.length || 0) > 1 && (
                  <span className="tag bg-orange-100 text-orange-700 text-xs">
                    {reply.messages?.length} boxes
                  </span>
                )}
                {reply.messages?.map((m, i) => (
                  <span key={i} className={`tag text-xs ${
                    m.type === 'flex' ? 'bg-purple-100 text-purple-700' :
                    m.type === 'image' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {m.type === 'flex' ? 'Flex' : m.type === 'image' ? 'Image' : 'Text'}
                  </span>
                ))}
              </div>
              
              {/* Shortcut */}
              {reply.shortcut && (
                <div className="text-xs text-gray-500 mb-2">
                  ทางลัด: <code className="bg-gray-100 px-1 rounded">/{reply.shortcut}</code>
                </div>
              )}
              
              {/* Content Preview */}
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {getPreviewText(reply)}
              </p>
              
              {/* Stats */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>ใช้งาน {reply.use_count} ครั้ง</span>
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
          onMessageChange={handleMessageChange}
          onAddMessage={handleAddMessage}
          onRemoveMessage={handleRemoveMessage}
          onMoveMessageUp={handleMoveMessageUp}
          onMoveMessageDown={handleMoveMessageDown}
        />
      )}
    </div>
  );
}

// ==================== Form Modal Component ====================

function QuickReplyFormModal({
  form,
  setForm,
  channels,
  editingReply,
  saving,
  onSubmit,
  onClose,
  onMessageChange,
  onAddMessage,
  onRemoveMessage,
  onMoveMessageUp,
  onMoveMessageDown
}: {
  form: any;
  setForm: (form: any) => void;
  channels: Channel[];
  editingReply: QuickReply | null;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onMessageChange: (index: number, box: MessageBox) => void;
  onAddMessage: () => void;
  onRemoveMessage: (index: number) => void;
  onMoveMessageUp: (index: number) => void;
  onMoveMessageDown: (index: number) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
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
              placeholder="เช่น โปรโมชั่นพิเศษ, ทักทายลูกค้า"
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
              placeholder="เช่น promo, hi, price"
              maxLength={50}
            />
            <p className="text-xs text-gray-500 mt-1">พิมพ์ /{form.shortcut || 'shortcut'} เพื่อเรียกใช้งานอย่างรวดเร็ว</p>
          </div>

          {/* Message Boxes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                ข้อความ <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-2">({form.messages.length} box)</span>
              </label>
              <button
                type="button"
                onClick={onAddMessage}
                className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                <FiPlus className="w-4 h-4" />
                เพิ่ม Box
              </button>
            </div>
            
            <div className="space-y-3">
              {form.messages.map((box: MessageBox, index: number) => (
                <MessageBoxEditor
                  key={index}
                  box={box}
                  index={index}
                  totalBoxes={form.messages.length}
                  onChange={onMessageChange}
                  onRemove={onRemoveMessage}
                  onMoveUp={onMoveMessageUp}
                  onMoveDown={onMoveMessageDown}
                />
              ))}
            </div>
            
            <p className="text-xs text-gray-500 mt-3">
              💡 เพิ่มได้หลาย Box แต่ละ Box จะส่งเป็นข้อความแยกกันตามลำดับ
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 sticky bottom-0 bg-white pb-2">
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