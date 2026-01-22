'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  FiMessageCircle, FiSend, FiUsers, FiRadio, FiImage,
  FiClock, FiCheckCircle, FiXCircle, FiTrash2,
  FiFilter, FiCalendar, FiAlertTriangle, FiInfo,
  FiDollarSign, FiZap, FiCode, FiHash, FiPlus,
  FiChevronUp, FiChevronDown, FiEye, FiX, FiCopy
} from 'react-icons/fi';
import Swal from 'sweetalert2';
import { FlexMessageRenderer } from '@/components/FlexMessageRenderer';

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
  isOwner?: boolean;
  permissions?: {
    can_reply?: boolean;
    can_view_all?: boolean;
    can_broadcast?: boolean;
    can_manage_tags?: boolean;
  };
}

// Message Box interface
interface MessageBox {
  id: string;
  type: 'text' | 'image' | 'flex';
  content: string;
  imageUrl: string;
  flexJson: string;
  altText: string;
  validation: {
    valid: boolean;
    error: string;
  };
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

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

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
    // ถ้าเป็นรูปแบบจาก Simulator (bubble/carousel) ใช้ตรงๆ
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

// Message Box Component
const MessageBoxCard: React.FC<{
  box: MessageBox;
  index: number;
  total: number;
  onUpdate: (box: MessageBox) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}> = ({ box, index, total, onUpdate, onDelete, onMoveUp, onMoveDown }) => {
  const [showPreview, setShowPreview] = useState(false);

  const handleTypeChange = (type: 'text' | 'image' | 'flex') => {
    onUpdate({ ...box, type });
  };

  const handleFlexChange = (flexJson: string) => {
    const validation = validateFlexJson(flexJson);
    onUpdate({
      ...box,
      flexJson,
      validation: {
        valid: validation.valid,
        error: validation.error
      }
    });
  };

  // Sample Flex from LINE Simulator format
  const sampleFlexSimulator = `{
  "type": "bubble",
  "size": "giga",
  "body": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "🎉 โปรโมชั่นพิเศษ!",
        "weight": "bold",
        "size": "xl",
        "color": "#1DB446"
      },
      {
        "type": "text",
        "text": "รับส่วนลด 20% สำหรับสมาชิกใหม่",
        "margin": "md",
        "wrap": true
      }
    ],
    "backgroundColor": "#FFFFFF",
    "paddingAll": "20px"
  }
}`;

  return (
    <div className="border-2 border-blue-200 rounded-xl bg-blue-50/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-100">
        <span className="px-3 py-1 bg-blue-500 text-white text-sm font-medium rounded-full">
          ข้อความที่ {index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className={`p-1.5 rounded-lg transition-colors ${
              index === 0 
                ? 'text-gray-300 cursor-not-allowed' 
                : 'text-blue-600 hover:bg-blue-200'
            }`}
            title="ขึ้น"
          >
            <FiChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className={`p-1.5 rounded-lg transition-colors ${
              index === total - 1 
                ? 'text-gray-300 cursor-not-allowed' 
                : 'text-blue-600 hover:bg-blue-200'
            }`}
            title="ลง"
          >
            <FiChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors ml-2"
            title="ลบ"
          >
            <FiTrash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Message Type Selection */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleTypeChange('text')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all ${
              box.type === 'text' 
                ? 'border-blue-500 bg-white text-blue-600' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <FiMessageCircle className="w-4 h-4" />
            <span className="text-sm font-medium">ข้อความ</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('image')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all ${
              box.type === 'image' 
                ? 'border-blue-500 bg-white text-blue-600' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <FiImage className="w-4 h-4" />
            <span className="text-sm font-medium">รูปภาพ</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('flex')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all ${
              box.type === 'flex' 
                ? 'border-blue-500 bg-white text-blue-600' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <FiCode className="w-4 h-4" />
            <span className="text-sm font-medium">Flex Message</span>
          </button>
        </div>

        {/* Text Input */}
        {box.type === 'text' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FiMessageCircle className="w-4 h-4 inline mr-1" />
              ข้อความ
            </label>
            <textarea
              value={box.content}
              onChange={(e) => onUpdate({ ...box, content: e.target.value })}
              className="input w-full"
              rows={4}
              placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
              maxLength={5000}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{box.content.length}/5000</p>
          </div>
        )}

        {/* Image Input */}
        {box.type === 'image' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FiImage className="w-4 h-4 inline mr-1" />
              URL รูปภาพ
            </label>
            <input
              type="url"
              value={box.imageUrl}
              onChange={(e) => onUpdate({ ...box, imageUrl: e.target.value })}
              className="input w-full"
              placeholder="https://example.com/image.jpg"
            />
            <p className="text-xs text-gray-500 mt-1">รองรับ JPEG, PNG ขนาดไม่เกิน 10MB</p>
            {box.imageUrl && (
              <div className="mt-2">
                <img 
                  src={box.imageUrl} 
                  alt="Preview" 
                  className="max-h-32 rounded-lg border border-gray-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Flex Input */}
        {box.type === 'flex' && (
          <div className="space-y-3">
            {/* Flex JSON Editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  <FiCode className="w-4 h-4 inline mr-1" />
                  Flex Message JSON
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleFlexChange(sampleFlexSimulator)}
                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    ใส่ตัวอย่าง
                  </button>
                  {box.flexJson && box.validation.valid && (
                    <button
                      type="button"
                      onClick={() => setShowPreview(true)}
                      className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                    >
                      <FiEye className="w-3 h-3" />
                      ดูตัวอย่าง
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={box.flexJson}
                onChange={(e) => handleFlexChange(e.target.value)}
                className={`input w-full font-mono text-sm ${
                  box.flexJson && !box.validation.valid ? 'border-red-500 focus:ring-red-500' : ''
                }`}
                rows={8}
                placeholder={`วาง Flex JSON จาก LINE Flex Message Simulator\n{\n  "type": "bubble",\n  "body": {...}\n}`}
              />
              
              {/* Validation Status */}
              {box.flexJson && (
                <div className={`mt-2 p-2 rounded-lg text-sm flex items-center gap-2 ${
                  box.validation.valid 
                    ? 'bg-green-50 text-green-700' 
                    : 'bg-red-50 text-red-700'
                }`}>
                  {box.validation.valid ? (
                    <>
                      <FiCheckCircle className="w-4 h-4" />
                      <span>JSON ถูกต้อง ✓</span>
                    </>
                  ) : (
                    <>
                      <FiXCircle className="w-4 h-4" />
                      <span>{box.validation.error}</span>
                    </>
                  )}
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-2">
                💡 วาง Flex Message JSON ที่สร้างจาก{' '}
                <a 
                  href="https://developers.line.biz/flex-simulator/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline"
                >
                  LINE Flex Message Simulator
                </a>
                {' '}ได้โดยตรง (ไม่ต้องมี "type": "flex")
              </p>
            </div>

            {/* Alt Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FiInfo className="w-4 h-4 inline mr-1" />
                Alt Text (ข้อความแสดงแทน)
              </label>
              <input
                type="text"
                value={box.altText}
                onChange={(e) => onUpdate({ ...box, altText: e.target.value })}
                className="input w-full"
                placeholder="ข้อความที่แสดงในการแจ้งเตือน"
              />
              <p className="text-xs text-gray-500 mt-1">
                ข้อความที่จะแสดงในการแจ้งเตือนและเมื่อไม่สามารถแสดง Flex ได้
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Flex Preview Modal */}
      <FlexPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        flexJson={box.flexJson}
        altText={box.altText}
      />
    </div>
  );
};

export default function BroadcastPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [userCount, setUserCount] = useState<number>(0);
  
  // Form state
  const [channelId, setChannelId] = useState('');
  const [broadcastType, setBroadcastType] = useState<'official' | 'push'>('push');
  const [limit, setLimit] = useState(0);
  const [messageBoxes, setMessageBoxes] = useState<MessageBox[]>([
    {
      id: generateId(),
      type: 'text',
      content: '',
      imageUrl: '',
      flexJson: '',
      altText: '',
      validation: { valid: true, error: '' }
    }
  ]);

  useEffect(() => {
    fetchBroadcasts();
    fetchChannels();
  }, []);

  useEffect(() => {
    if (channelId) {
      fetchUserCount(channelId);
    } else {
      setUserCount(0);
    }
  }, [channelId]);

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
        // กรองเฉพาะ channels ที่มีสิทธิ์ broadcast (isOwner หรือ can_broadcast = true)
        const broadcastableChannels = data.data.filter((ch: Channel) => 
          ch.isOwner || ch.permissions?.can_broadcast === true
        );
        setChannels(broadcastableChannels);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  const fetchUserCount = async (chId: string) => {
    try {
      const res = await fetch(`/api/broadcast/user-count?channel_id=${chId}`);
      const data = await res.json();
      if (data.success) {
        setUserCount(data.data.count);
      }
    } catch (error) {
      console.error('Error fetching user count:', error);
    }
  };

  // Message Box handlers
  const addMessageBox = () => {
    if (messageBoxes.length >= 5) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'เกินจำนวนที่กำหนด', 
        text: 'สามารถส่งได้สูงสุด 5 ข้อความต่อครั้ง' 
      });
      return;
    }
    setMessageBoxes([
      ...messageBoxes,
      {
        id: generateId(),
        type: 'text',
        content: '',
        imageUrl: '',
        flexJson: '',
        altText: '',
        validation: { valid: true, error: '' }
      }
    ]);
  };

  const updateMessageBox = (index: number, box: MessageBox) => {
    const newBoxes = [...messageBoxes];
    newBoxes[index] = box;
    setMessageBoxes(newBoxes);
  };

  const deleteMessageBox = (index: number) => {
    if (messageBoxes.length <= 1) {
      Swal.fire({ icon: 'warning', title: 'ต้องมีอย่างน้อย 1 ข้อความ' });
      return;
    }
    const newBoxes = messageBoxes.filter((_, i) => i !== index);
    setMessageBoxes(newBoxes);
  };

  const moveMessageBox = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= messageBoxes.length) return;
    
    const newBoxes = [...messageBoxes];
    [newBoxes[index], newBoxes[newIndex]] = [newBoxes[newIndex], newBoxes[index]];
    setMessageBoxes(newBoxes);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!channelId) {
      Swal.fire({ icon: 'warning', title: 'กรุณาเลือก Channel' });
      return;
    }

    // Validate all message boxes
    const errors: string[] = [];
    messageBoxes.forEach((box, i) => {
      if (box.type === 'text' && !box.content.trim()) {
        errors.push(`ข้อความที่ ${i + 1}: กรุณาใส่ข้อความ`);
      }
      if (box.type === 'image' && !box.imageUrl.trim()) {
        errors.push(`ข้อความที่ ${i + 1}: กรุณาใส่ URL รูปภาพ`);
      }
      if (box.type === 'flex') {
        if (!box.flexJson.trim()) {
          errors.push(`ข้อความที่ ${i + 1}: กรุณาใส่ Flex JSON`);
        } else if (!box.validation.valid) {
          errors.push(`ข้อความที่ ${i + 1}: ${box.validation.error}`);
        }
      }
    });

    if (errors.length > 0) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'ข้อมูลไม่ครบถ้วน', 
        html: errors.map(e => `• ${e}`).join('<br/>') 
      });
      return;
    }

    const channel = channels.find(c => c.id === channelId);
    const maxCount = broadcastType === 'official' 
      ? channel?.followers_count || 0 
      : userCount;
    const targetCount = limit > 0 ? Math.min(limit, maxCount) : maxCount;
    
    const result = await Swal.fire({
      title: 'ยืนยันการส่ง Broadcast',
      html: `
        <div class="text-left space-y-2">
          <p><strong>Channel:</strong> ${channel?.channel_name}</p>
          <p><strong>ประเภท:</strong> ${broadcastType === 'official' ? '📢 Broadcast ปกติ' : '🚀 Push Broadcast (ฟรี)'}</p>
          <p><strong>จำนวนข้อความ:</strong> ${messageBoxes.length} ข้อความ</p>
          <p><strong>จำนวนเป้าหมาย:</strong> ${targetCount.toLocaleString()} / ${maxCount.toLocaleString()} คน</p>
          ${broadcastType === 'push' ? `
            <div class="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <p class="text-green-700">✅ <strong>ฟรี!</strong> ไม่เสียค่าส่ง</p>
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
        // Prepare messages
        const messages = messageBoxes.map(box => {
          if (box.type === 'text') {
            return { type: 'text', content: box.content };
          }
          if (box.type === 'image') {
            return { type: 'image', content: box.imageUrl };
          }
          if (box.type === 'flex') {
            return { 
              type: 'flex', 
              content: box.flexJson,
              altText: box.altText || 'Flex Message'
            };
          }
          return null;
        }).filter(Boolean);

        const res = await fetch('/api/broadcast/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel_id: channelId,
            broadcast_type: broadcastType,
            messages: messages,
            limit: limit > 0 ? limit : 0,
            delay_ms: 100
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
    setChannelId('');
    setBroadcastType('push');
    setLimit(0);
    setMessageBoxes([
      {
        id: generateId(),
        type: 'text',
        content: '',
        imageUrl: '',
        flexJson: '',
        altText: '',
        validation: { valid: true, error: '' }
      }
    ]);
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
    flex: { label: 'Flex', color: 'bg-orange-100 text-orange-700' },
    multi: { label: 'หลายข้อความ', color: 'bg-indigo-100 text-indigo-700' }
  };

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
                <span className="text-green-500">• ไม่เสียค่าส่ง • รองรับ Flex Message • ส่งได้สูงสุด 5 ข้อความ</span>
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
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">สร้าง Broadcast</h2>
              <button onClick={() => { setShowCompose(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSend} className="p-6 space-y-6">
              {/* Channel Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เลือก LINE OA <span className="text-red-500">*</span>
                </label>
                <select
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
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
                    onClick={() => setBroadcastType('push')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      broadcastType === 'push' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FiZap className={`w-5 h-5 ${broadcastType === 'push' ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className={`font-semibold ${broadcastType === 'push' ? 'text-green-700' : 'text-gray-700'}`}>
                        Push Broadcast
                      </span>
                      <span className="px-1.5 py-0.5 bg-green-500 text-white text-xs rounded">ฟรี!</span>
                    </div>
                    <p className="text-xs text-gray-500">ส่งเฉพาะคนที่ทักมา</p>
                    {channelId && (
                      <p className="text-xs text-green-600 mt-1 font-medium">👥 ส่งได้ {userCount.toLocaleString()} คน</p>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setBroadcastType('official')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      broadcastType === 'official' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FiDollarSign className={`w-5 h-5 ${broadcastType === 'official' ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className={`font-semibold ${broadcastType === 'official' ? 'text-blue-700' : 'text-gray-700'}`}>
                        Broadcast ปกติ
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">ใช้โควต้า LINE OA</p>
                    {channelId && (
                      <p className="text-xs text-blue-600 mt-1 font-medium">
                        👥 {channels.find(c => c.id === channelId)?.followers_count?.toLocaleString() || 0} คน
                      </p>
                    )}
                  </button>
                </div>
              </div>

              {/* Limit (Push only) */}
              {broadcastType === 'push' && channelId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <FiHash className="w-4 h-4 inline mr-1" />
                    จำนวนที่ต้องการส่ง
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={limit || ''}
                      onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
                      className="input w-32"
                      placeholder="ทั้งหมด"
                      min={0}
                      max={userCount}
                    />
                    <span className="text-sm text-gray-500">
                      / {userCount.toLocaleString()} คน
                      {limit > 0 && limit <= userCount && (
                        <span className="text-green-600 ml-2">
                          (ส่งคนที่ 1 - {limit.toLocaleString()})
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    เว้นว่างหรือใส่ 0 = ส่งทั้งหมด • เรียงตามวันที่ทักมา (เก่า → ใหม่)
                  </p>
                </div>
              )}

              {/* Message Boxes */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    ข้อความที่ต้องการส่ง <span className="text-red-500">*</span>
                  </label>
                  <span className="text-sm text-gray-500">{messageBoxes.length}/5 ข้อความ</span>
                </div>

                {messageBoxes.map((box, index) => (
                  <MessageBoxCard
                    key={box.id}
                    box={box}
                    index={index}
                    total={messageBoxes.length}
                    onUpdate={(updatedBox) => updateMessageBox(index, updatedBox)}
                    onDelete={() => deleteMessageBox(index)}
                    onMoveUp={() => moveMessageBox(index, 'up')}
                    onMoveDown={() => moveMessageBox(index, 'down')}
                  />
                ))}

                {/* Add Message Button */}
                {messageBoxes.length < 5 && (
                  <button
                    type="button"
                    onClick={addMessageBox}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-green-500 hover:text-green-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <FiPlus className="w-5 h-5" />
                    เพิ่มข้อความ
                  </button>
                )}
              </div>

              {/* Info Box */}
              {broadcastType === 'push' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <FiAlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-amber-700 font-medium">ข้อจำกัดของ Push Broadcast</p>
                      <ul className="text-amber-600 mt-1 space-y-0.5">
                        <li>• ส่งได้เฉพาะคนที่เคยทักมาหา Channel นี้</li>
                        <li>• ไม่สามารถดึง followers ที่ไม่ทักมาได้ (LINE API ไม่รองรับ)</li>
                        <li>• ระบบส่งแบบ batch 500 คน/ครั้ง ป้องกัน rate limit</li>
                        <li>• ส่งได้สูงสุด 5 ข้อความต่อครั้ง</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 sticky bottom-0 bg-white py-4 -mx-6 px-6 border-t border-gray-100">
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