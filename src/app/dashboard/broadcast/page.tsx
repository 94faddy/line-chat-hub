// src/app/dashboard/broadcast/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  FiMessageCircle, FiSend, FiUsers, FiRadio, FiImage,
  FiClock, FiCheckCircle, FiXCircle, FiBarChart2,
  FiFilter, FiCalendar, FiAlertTriangle, FiInfo,
  FiDollarSign, FiZap, FiCode, FiHash, FiPlus,
  FiChevronUp, FiChevronDown, FiEye, FiX, FiCopy,
  FiChevronLeft, FiChevronRight, FiSearch, FiUser
} from 'react-icons/fi';
import Swal from 'sweetalert2';
import { FlexMessageRenderer } from '@/components/FlexMessageRenderer';

interface Broadcast {
  id: string;
  channel_id: string;
  channel_name: string;
  broadcast_type: 'official' | 'push';
  message_type: 'text' | 'image' | 'flex' | 'multi';
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

// ✅ เพิ่ม Interface สำหรับผู้รับ
interface Recipient {
  id: string;
  line_user_id: string;
  display_name: string;
  picture_url?: string;
  status: 'sent' | 'failed' | 'pending';
  error_message?: string;
  sent_at?: string;
}

interface RecipientStats {
  sent: number;
  failed: number;
  pending: number;
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

// Validate Flex JSON
const validateFlexJson = (json: string): { valid: boolean; error: string; parsed?: any } => {
  if (!json.trim()) {
    return { valid: false, error: 'กรุณาใส่ Flex Message JSON' };
  }

  try {
    const parsed = JSON.parse(json);
    if (parsed.type === 'bubble' || parsed.type === 'carousel') {
      return { valid: true, error: '', parsed };
    }
    if (parsed.type === 'flex') {
      if (!parsed.altText) {
        return { valid: false, error: 'ต้องมี "altText"' };
      }
      if (!parsed.contents) {
        return { valid: false, error: 'ต้องมี "contents"' };
      }
      return { valid: true, error: '', parsed };
    }
    return { valid: false, error: 'JSON ต้องมี type เป็น "bubble", "carousel" หรือ "flex"' };
  } catch (e) {
    return { valid: false, error: 'JSON format ไม่ถูกต้อง' };
  }
};

// ✅ Broadcast Detail Modal Component
const BroadcastDetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  broadcast: Broadcast | null;
}> = ({ isOpen, onClose, broadcast }) => {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<RecipientStats>({ sent: 0, failed: 0, pending: 0 });
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [search, setSearch] = useState('');

  const fetchRecipients = useCallback(async () => {
    if (!broadcast) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (filterStatus) params.append('status', filterStatus);
      if (search) params.append('search', search);
      
      const res = await fetch(`/api/broadcast/${broadcast.id}/recipients?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setRecipients(data.data.recipients);
        setTotalPages(data.data.pagination.totalPages);
        setTotal(data.data.pagination.total);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Fetch recipients error:', error);
    } finally {
      setLoading(false);
    }
  }, [broadcast, page, filterStatus, search]);

  useEffect(() => {
    if (isOpen && broadcast) {
      setPage(1);
      fetchRecipients();
    }
  }, [isOpen, broadcast]);

  useEffect(() => {
    if (isOpen && broadcast) {
      fetchRecipients();
    }
  }, [page, filterStatus]);

  const handleSearch = () => {
    setPage(1);
    fetchRecipients();
  };

  if (!isOpen || !broadcast) return null;

  const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: 'แบบร่าง', color: 'bg-gray-100 text-gray-700' },
    scheduled: { label: 'ตั้งเวลาไว้', color: 'bg-yellow-100 text-yellow-700' },
    sending: { label: 'กำลังส่ง', color: 'bg-blue-100 text-blue-700' },
    completed: { label: 'สำเร็จ', color: 'bg-green-100 text-green-700' },
    failed: { label: 'ล้มเหลว', color: 'bg-red-100 text-red-700' }
  };

  const broadcastTypeConfig: Record<string, { label: string; color: string }> = {
    official: { label: 'Broadcast ปกติ', color: 'bg-blue-100 text-blue-700' },
    push: { label: 'Push (ฟรี)', color: 'bg-green-100 text-green-700' }
  };

  const messageTypeConfig: Record<string, { label: string; color: string }> = {
    text: { label: 'ข้อความ', color: 'bg-gray-100 text-gray-700' },
    image: { label: 'รูปภาพ', color: 'bg-purple-100 text-purple-700' },
    flex: { label: 'Flex', color: 'bg-orange-100 text-orange-700' },
    multi: { label: 'หลายข้อความ', color: 'bg-indigo-100 text-indigo-700' }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-fadeIn flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">ข้อมูลเชิงลึก Broadcast</h2>
            <p className="text-sm text-gray-500">{broadcast.channel_name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Broadcast Info */}
          <div className="p-6 bg-gray-50 border-b border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left - Info */}
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${broadcastTypeConfig[broadcast.broadcast_type]?.color}`}>
                    {broadcastTypeConfig[broadcast.broadcast_type]?.label}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${messageTypeConfig[broadcast.message_type]?.color}`}>
                    {messageTypeConfig[broadcast.message_type]?.label}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[broadcast.status]?.color}`}>
                    {statusConfig[broadcast.status]?.label}
                  </span>
                </div>
                
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">เนื้อหาที่ส่ง:</p>
                  <p className="text-gray-900">{broadcast.content || '-'}</p>
                </div>
                
                {broadcast.sent_at && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FiClock className="w-4 h-4" />
                    <span>ส่งเมื่อ: {formatThaiDateTime(broadcast.sent_at)}</span>
                  </div>
                )}
              </div>

              {/* Right - Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                  <p className="text-2xl font-bold text-gray-900">{broadcast.target_count.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">เป้าหมาย</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200 text-center">
                  <p className="text-2xl font-bold text-green-600">{broadcast.sent_count.toLocaleString()}</p>
                  <p className="text-sm text-green-600">ส่งสำเร็จ</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200 text-center">
                  <p className="text-2xl font-bold text-red-600">{broadcast.failed_count.toLocaleString()}</p>
                  <p className="text-sm text-red-600">ล้มเหลว</p>
                </div>
              </div>
            </div>

            {/* Success Rate */}
            {broadcast.target_count > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">อัตราความสำเร็จ</span>
                  <span className="font-medium text-green-600">
                    {((broadcast.sent_count / broadcast.target_count) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(broadcast.sent_count / broadcast.target_count) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Recipients List */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FiUsers className="w-5 h-5" />
                รายชื่อผู้รับ ({total.toLocaleString()} คน)
              </h3>
              
              {/* Filter & Search */}
              <div className="flex items-center gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  className="input py-1.5 text-sm"
                >
                  <option value="">ทั้งหมด</option>
                  <option value="sent">ส่งสำเร็จ</option>
                  <option value="failed">ล้มเหลว</option>
                </select>
                
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="ค้นหาชื่อ..."
                    className="input py-1.5 text-sm pl-8 w-40"
                  />
                  <FiSearch className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <button onClick={handleSearch} className="btn btn-secondary py-1.5 text-sm">
                  ค้นหา
                </button>
              </div>
            </div>

            {/* Stats Pills */}
            <div className="flex gap-2 mb-4">
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                ✅ ส่งสำเร็จ: {stats.sent.toLocaleString()}
              </span>
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                ❌ ล้มเหลว: {stats.failed.toLocaleString()}
              </span>
            </div>

            {/* Recipients Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="spinner w-8 h-8 border-green-500 border-t-transparent" />
              </div>
            ) : recipients.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FiUsers className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p>ไม่พบข้อมูลผู้รับ</p>
                <p className="text-sm mt-1">อาจเป็นเพราะ Broadcast นี้ส่งก่อนที่จะมีฟีเจอร์นี้</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">ผู้ใช้</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">LINE User ID</th>
                      <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">สถานะ</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">เวลาส่ง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recipients.map((recipient) => (
                      <tr key={recipient.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {recipient.picture_url ? (
                              <img 
                                src={recipient.picture_url} 
                                alt={recipient.display_name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <FiUser className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <span className="font-medium text-gray-900">{recipient.display_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                            {recipient.line_user_id.substring(0, 20)}...
                          </code>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {recipient.status === 'sent' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                              <FiCheckCircle className="w-3 h-3" />
                              สำเร็จ
                            </span>
                          ) : recipient.status === 'failed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs" title={recipient.error_message}>
                              <FiXCircle className="w-3 h-3" />
                              ล้มเหลว
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                              <FiClock className="w-3 h-3" />
                              รอดำเนินการ
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {recipient.sent_at ? formatThaiDateTime(recipient.sent_at) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  หน้า {page} จาก {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary py-1.5 px-3 disabled:opacity-50"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn btn-secondary py-1.5 px-3 disabled:opacity-50"
                  >
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="btn btn-secondary w-full">
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
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
          <div className="flex justify-end mb-4">
            <div className="bg-[#A8D98A] rounded-2xl rounded-tr-sm px-4 py-2 max-w-[70%]">
              <p className="text-sm">ส่ง Flex Message</p>
            </div>
          </div>
          
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
          
          {altText && (
            <div className="mt-4 p-3 bg-white/90 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Alt Text:</p>
              <p className="text-sm text-gray-700">{altText}</p>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-100">
          <button onClick={onClose} className="btn btn-secondary w-full">ปิด</button>
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
      validation: { valid: validation.valid, error: validation.error }
    });
  };

  const sampleFlexSimulator = `{
  "type": "bubble",
  "size": "giga",
  "body": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "สวัสดี!",
        "weight": "bold",
        "size": "xl"
      }
    ]
  }
}`;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">ข้อความ #{index + 1}</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => handleTypeChange('text')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                box.type === 'text' ? 'bg-green-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              ข้อความ
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('image')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                box.type === 'image' ? 'bg-purple-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              รูปภาพ
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('flex')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                box.type === 'flex' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Flex
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
          >
            <FiChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
          >
            <FiChevronDown className="w-4 h-4" />
          </button>
          {total > 1 && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded ml-2"
            >
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {box.type === 'text' && (
          <textarea
            value={box.content}
            onChange={(e) => onUpdate({ ...box, content: e.target.value })}
            placeholder="พิมพ์ข้อความที่ต้องการส่ง..."
            className="input min-h-[100px] resize-none"
            required
          />
        )}

        {box.type === 'image' && (
          <div className="space-y-2">
            <input
              type="url"
              value={box.imageUrl}
              onChange={(e) => onUpdate({ ...box, imageUrl: e.target.value })}
              placeholder="URL รูปภาพ (https://...)"
              className="input"
              required
            />
            {box.imageUrl && (
              <div className="border border-gray-200 rounded-lg p-2">
                <img src={box.imageUrl} alt="Preview" className="max-h-48 mx-auto rounded" />
              </div>
            )}
          </div>
        )}

        {box.type === 'flex' && (
          <div className="space-y-3">
            <div>
              <input
                type="text"
                value={box.altText}
                onChange={(e) => onUpdate({ ...box, altText: e.target.value })}
                placeholder="Alt Text (แสดงในการแจ้งเตือน)"
                className="input mb-2"
              />
              <div className="relative">
                <textarea
                  value={box.flexJson}
                  onChange={(e) => handleFlexChange(e.target.value)}
                  placeholder="วาง Flex JSON ที่นี่..."
                  className={`input min-h-[150px] font-mono text-sm resize-none ${
                    box.flexJson && !box.validation.valid ? 'border-red-300 bg-red-50' : ''
                  }`}
                />
                {box.flexJson && !box.validation.valid && (
                  <p className="text-red-500 text-sm mt-1">⚠️ {box.validation.error}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleFlexChange(sampleFlexSimulator)}
                className="btn btn-secondary text-xs py-1.5"
              >
                <FiCopy className="w-3 h-3 mr-1" />
                ตัวอย่าง
              </button>
              {box.flexJson && box.validation.valid && (
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="btn btn-secondary text-xs py-1.5"
                >
                  <FiEye className="w-3 h-3 mr-1" />
                  ดูตัวอย่าง
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <FlexPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        flexJson={box.flexJson}
        altText={box.altText}
      />
    </div>
  );
};

// Main Component
export default function BroadcastPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  
  // ✅ State สำหรับ Detail Modal
  const [showDetail, setShowDetail] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);

  // Form state
  const [channelId, setChannelId] = useState('');
  const [broadcastType, setBroadcastType] = useState<'official' | 'push'>('push');
  const [userCount, setUserCount] = useState(0);
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
      fetchUserCount();
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
      console.error('Fetch broadcasts error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      if (data.success) {
        const filtered = data.data.filter((ch: Channel) =>
          ch.isOwner || ch.permissions?.can_broadcast
        );
        setChannels(filtered);
      }
    } catch (error) {
      console.error('Fetch channels error:', error);
    }
  };

  const fetchUserCount = async () => {
    try {
      const res = await fetch(`/api/broadcast/user-count?channel_id=${channelId}`);
      const data = await res.json();
      if (data.success) {
        setUserCount(data.data.count);
      }
    } catch (error) {
      console.error('Fetch user count error:', error);
    }
  };

  const addMessageBox = () => {
    if (messageBoxes.length < 5) {
      setMessageBoxes([...messageBoxes, {
        id: generateId(),
        type: 'text',
        content: '',
        imageUrl: '',
        flexJson: '',
        altText: '',
        validation: { valid: true, error: '' }
      }]);
    }
  };

  const updateMessageBox = (index: number, box: MessageBox) => {
    const newBoxes = [...messageBoxes];
    newBoxes[index] = box;
    setMessageBoxes(newBoxes);
  };

  const deleteMessageBox = (index: number) => {
    if (messageBoxes.length > 1) {
      setMessageBoxes(messageBoxes.filter((_, i) => i !== index));
    }
  };

  const moveMessageBox = (index: number, direction: 'up' | 'down') => {
    const newBoxes = [...messageBoxes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newBoxes.length) {
      [newBoxes[index], newBoxes[targetIndex]] = [newBoxes[targetIndex], newBoxes[index]];
      setMessageBoxes(newBoxes);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const hasInvalidFlex = messageBoxes.some(
      box => box.type === 'flex' && !box.validation.valid
    );
    
    if (hasInvalidFlex) {
      Swal.fire({ icon: 'error', title: 'Flex JSON ไม่ถูกต้อง', text: 'กรุณาตรวจสอบ Flex JSON' });
      return;
    }

    const messages = messageBoxes.map(box => {
      if (box.type === 'text') {
        return { type: 'text', content: box.content };
      } else if (box.type === 'image') {
        return { type: 'image', content: box.imageUrl };
      } else {
        return { type: 'flex', content: box.flexJson, altText: box.altText || 'Flex Message' };
      }
    }).filter(m => m.content);

    if (messages.length === 0) {
      Swal.fire({ icon: 'warning', title: 'กรุณาใส่ข้อความ' });
      return;
    }

    const result = await Swal.fire({
      icon: 'question',
      title: 'ยืนยันการส่ง?',
      html: `ส่ง ${messages.length} ข้อความ ไปยัง ${limit > 0 ? limit.toLocaleString() : userCount.toLocaleString()} คน`,
      showCancelButton: true,
      confirmButtonColor: '#06C755',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ส่งเลย',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      setSending(true);
      try {
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
          throw new Error(data.message);
        }
      } catch (error: any) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: error.message });
      } finally {
        setSending(false);
      }
    }
  };

  const resetForm = () => {
    setChannelId('');
    setBroadcastType('push');
    setLimit(0);
    setMessageBoxes([{
      id: generateId(),
      type: 'text',
      content: '',
      imageUrl: '',
      flexJson: '',
      altText: '',
      validation: { valid: true, error: '' }
    }]);
  };

  // ✅ ฟังก์ชันเปิด Detail Modal
  const handleViewDetail = (broadcast: Broadcast) => {
    setSelectedBroadcast(broadcast);
    setShowDetail(true);
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
    <div className="max-w-5xl mx-auto p-6">
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
                <strong>ฟรี 100%!</strong> ส่งไปหาคนที่เคยทักมาหา Channel
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
                ส่งถึงทุกคนที่ Follow (ต้องซื้อ Package)
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
                        {broadcast.content}
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
                    {/* ✅ เปลี่ยนจากปุ่มลบเป็นปุ่มดูข้อมูลเชิงลึก */}
                    <button
                      onClick={() => handleViewDetail(broadcast)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="ดูข้อมูลเชิงลึก"
                    >
                      <FiBarChart2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ Detail Modal */}
      <BroadcastDetailModal
        isOpen={showDetail}
        onClose={() => { setShowDetail(false); setSelectedBroadcast(null); }}
        broadcast={selectedBroadcast}
      />

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
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">เว้นว่างหรือใส่ 0 = ส่งทั้งหมด</p>
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