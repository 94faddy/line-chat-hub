'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { 
  FiSearch, FiFilter, FiMoreVertical, FiSend, FiImage, 
  FiSmile, FiPaperclip, FiCheck, FiCheckCircle, FiX,
  FiTag, FiUser, FiMessageCircle, FiInbox, FiZap, FiPlus,
  FiTrash2, FiEdit2, FiBell, FiBellOff, FiDownload, FiExternalLink,
  FiChevronDown, FiRefreshCw, FiFileText, FiUserCheck, FiUsers, FiCode
} from 'react-icons/fi';
import Swal from 'sweetalert2';
import { FlexMessageRenderer, LinkifyText } from '@/components/FlexMessageRenderer';
import QuickRepliesPanel from '@/components/QuickRepliesPanel';
import TagsManager from '@/components/TagsManager';

interface Channel {
  id: string;
  channel_name: string;
  picture_url?: string;
  basic_id?: string;
}

interface LineUser {
  id: string;
  display_name?: string;
  picture_url?: string;
  line_user_id: string;
  follow_status?: 'following' | 'unfollowed' | 'blocked' | 'unknown';
  // ✅ เพิ่มรองรับ Group/Room
  source_type?: 'user' | 'group' | 'room';
  group_id?: string;
  room_id?: string;
  member_count?: number;
}

interface Tag {
  id: string;
  name: string;
  color: string;
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
}

interface Admin {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
}

interface Conversation {
  id: string;
  channel_id: string;
  line_user_id: string;
  status: string;
  last_message_preview?: string;
  last_message_at?: string;
  unread_count: number;
  channel: Channel;
  line_user: LineUser;
  tags?: Tag[];
  notes?: string;
  assigned_to?: Admin;
}

interface Message {
  id: string;
  direction: 'incoming' | 'outgoing';
  message_type: string;
  content?: string;
  media_url?: string;
  sticker_id?: string;
  package_id?: string;
  flex_content?: string;
  source_type?: string;
  // ✅ ข้อมูลคนส่งในกลุ่ม LINE
  sender_info?: {
    user_id: string;
    display_name?: string;
    picture_url?: string;
  };
  // ✅ ข้อมูล admin ที่ตอบข้อความ
  sent_by?: {
    id: string;
    name: string;
    avatar?: string;
  };
  created_at: string;
}

// ============================================
// LINE Sticker Packages (ใช้ได้ฟรี)
// ============================================
const LINE_STICKER_PACKAGES = [
  {
    packageId: '11537',
    name: 'Moon & James',
    stickers: ['52002734', '52002735', '52002736', '52002737', '52002738', '52002739', '52002740', '52002741', '52002742', '52002743', '52002744', '52002745', '52002746', '52002747', '52002748', '52002749', '52002750', '52002751', '52002752', '52002753', '52002754', '52002755', '52002756', '52002757', '52002758', '52002759', '52002760', '52002761', '52002762', '52002763', '52002764', '52002765', '52002766', '52002767', '52002768', '52002769', '52002770', '52002771', '52002772', '52002773']
  },
  {
    packageId: '11538',
    name: 'Brown & Cony',
    stickers: ['51626494', '51626495', '51626496', '51626497', '51626498', '51626499', '51626500', '51626501', '51626502', '51626503', '51626504', '51626505', '51626506', '51626507', '51626508', '51626509', '51626510', '51626511', '51626512', '51626513', '51626514', '51626515', '51626516', '51626517', '51626518', '51626519', '51626520', '51626521', '51626522', '51626523', '51626524', '51626525', '51626526', '51626527', '51626528', '51626529', '51626530', '51626531', '51626532', '51626533']
  },
  {
    packageId: '11539',
    name: 'Cony',
    stickers: ['52114110', '52114111', '52114112', '52114113', '52114114', '52114115', '52114116', '52114117', '52114118', '52114119', '52114120', '52114121', '52114122', '52114123', '52114124', '52114125', '52114126', '52114127', '52114128', '52114129', '52114130', '52114131', '52114132', '52114133', '52114134', '52114135', '52114136', '52114137', '52114138', '52114139', '52114140', '52114141', '52114142', '52114143', '52114144', '52114145', '52114146', '52114147', '52114148', '52114149']
  },
  {
    packageId: '6359',
    name: 'Brown & Friends',
    stickers: ['11069850', '11069851', '11069852', '11069853', '11069854', '11069855', '11069856', '11069857', '11069858', '11069859', '11069860', '11069861', '11069862', '11069863', '11069864', '11069865', '11069866', '11069867', '11069868', '11069869', '11069870', '11069871', '11069872', '11069873']
  }
];

// ============================================
// Emoji Data
// ============================================
const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐']
  },
  {
    name: 'Gestures',
    emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁', '👅', '👄']
  },
  {
    name: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '💋', '👄', '🫦']
  },
  {
    name: 'Animals',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘']
  },
  {
    name: 'Food',
    emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕️', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊']
  },
  {
    name: 'Objects',
    emojis: ['⌚️', '📱', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭', '⏱', '⏲', '⏰', '🕰', '⌛️', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🪔', '🧯', '🛢', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒', '🛠', '⛏', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡', '⚔️', '🛡', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪']
  },
  {
    name: 'Symbols',
    emojis: ['✅', '❌', '❓', '❗️', '‼️', '⁉️', '💯', '🔥', '✨', '⭐️', '🌟', '💫', '💥', '💢', '💦', '💨', '🕳', '💬', '👁‍🗨', '🗨', '🗯', '💭', '💤', '🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫️', '⚪️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛️', '⬜️', '◼️', '◻️', '▪️', '▫️', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲']
  }
];

// ============================================
// Helper function แปลง /uploads/ เป็น /api/media/
// ============================================
const getMediaUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.includes('/uploads/')) {
    return url.replace('/uploads/', '/api/media/');
  }
  return url;
};

// ============================================
// Browser Notification Helper
// ============================================
const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  
  if (!('Notification' in window)) {
    console.log('Browser ไม่รองรับ Notification');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

const showBrowserNotification = (title: string, body: string, icon?: string) => {
  if (typeof window === 'undefined') return;
  
  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'new-message-' + Date.now(),
        requireInteraction: false,
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      
      setTimeout(() => notification.close(), 5000);
    } catch (e) {
      console.log('Notification error:', e);
    }
  }
};

// ฟังก์ชันแปลงเวลาเป็น Asia/Bangkok timezone แบบ relative
function formatThaiTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'เมื่อสักครู่';
  } else if (diffMins < 60) {
    return `${diffMins} นาทีที่แล้ว`;
  } else if (diffHours < 24) {
    return `${diffHours} ชั่วโมงที่แล้ว`;
  } else if (diffDays < 7) {
    return `${diffDays} วันที่แล้ว`;
  } else {
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Bangkok'
    });
  }
}

// ฟังก์ชันแสดงเวลาข้อความแบบละเอียด
function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  
  const isToday = date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) === 
                  now.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) === 
                      yesterday.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });

  const timeStr = date.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok'
  });

  if (isToday) {
    return timeStr;
  } else if (isYesterday) {
    return `เมื่อวาน ${timeStr}`;
  } else {
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Bangkok'
    }) + ' ' + timeStr;
  }
}

// Image Modal Component
function ImageModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
      >
        <FiX className="w-6 h-6 text-white" />
      </button>
      
      <div className="absolute top-4 right-16 flex gap-2">
        <a
          href={url}
          download
          onClick={(e) => e.stopPropagation()}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          title="ดาวน์โหลด"
        >
          <FiDownload className="w-5 h-5 text-white" />
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          title="เปิดในแท็บใหม่"
        >
          <FiExternalLink className="w-5 h-5 text-white" />
        </a>
      </div>
      
      <div 
        className="relative"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '50vw', maxHeight: '80vh' }}
      >
        <img 
          src={url} 
          alt="Preview" 
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
      </div>
    </div>
  );
}

// ============================================
// Emoji Picker Component
// ============================================
interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEmojis = searchQuery
    ? EMOJI_CATEGORIES.flatMap(cat => cat.emojis).filter(emoji => emoji.includes(searchQuery))
    : EMOJI_CATEGORIES[activeCategory].emojis;

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-200 w-80 z-50">
      {/* Header */}
      <div className="p-2 border-b border-gray-100">
        <input
          type="text"
          placeholder="ค้นหา emoji..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <div className="flex border-b border-gray-100 px-1">
          {EMOJI_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(idx)}
              className={`flex-1 py-2 text-lg hover:bg-gray-50 rounded-t transition-colors ${
                activeCategory === idx ? 'bg-gray-100' : ''
              }`}
              title={cat.name}
            >
              {cat.emojis[0]}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="p-2 h-48 overflow-y-auto">
        <div className="grid grid-cols-8 gap-1">
          {filteredEmojis.map((emoji, idx) => (
            <button
              key={idx}
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              className="w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 rounded transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Close button */}
      <div className="p-2 border-t border-gray-100 flex justify-end">
        <button
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          ปิด
        </button>
      </div>
    </div>
  );
}

// ============================================
// LINE Sticker Picker Component
// ============================================
interface StickerPickerProps {
  onSelect: (packageId: string, stickerId: string) => void;
  onClose: () => void;
}

function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  const [activePackage, setActivePackage] = useState(0);

  return (
    <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-200 w-96 z-50">
      {/* Header */}
      <div className="p-3 border-b border-gray-100 flex justify-between items-center">
        <span className="font-medium text-gray-700">LINE Stickers</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <FiX className="w-4 h-4" />
        </button>
      </div>

      {/* Package Tabs */}
      <div className="flex border-b border-gray-100 px-2 overflow-x-auto">
        {LINE_STICKER_PACKAGES.map((pkg, idx) => (
          <button
            key={pkg.packageId}
            onClick={() => setActivePackage(idx)}
            className={`px-3 py-2 text-sm whitespace-nowrap hover:bg-gray-50 transition-colors ${
              activePackage === idx ? 'border-b-2 border-green-500 text-green-600 font-medium' : 'text-gray-600'
            }`}
          >
            {pkg.name}
          </button>
        ))}
      </div>

      {/* Sticker Grid */}
      <div className="p-3 h-64 overflow-y-auto">
        <div className="grid grid-cols-4 gap-2">
          {LINE_STICKER_PACKAGES[activePackage].stickers.slice(0, 20).map((stickerId) => (
            <button
              key={stickerId}
              onClick={() => {
                onSelect(LINE_STICKER_PACKAGES[activePackage].packageId, stickerId);
                onClose();
              }}
              className="aspect-square bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors p-1 flex items-center justify-center"
            >
              <img
                src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerId}/android/sticker.png`}
                alt="Sticker"
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// New Message Bubble Component
// ============================================
interface NewMessageBubbleProps {
  message: Message;
  senderName: string;
  onClick: () => void;
}

function NewMessageBubble({ message, senderName, onClick }: NewMessageBubbleProps) {
  const getPreview = () => {
    switch (message.message_type) {
      case 'text': return message.content?.substring(0, 100) || '';
      case 'image': return '📷 ส่งรูปภาพ';
      case 'video': return '🎬 ส่งวิดีโอ';
      case 'audio': return '🎵 ส่งเสียง';
      case 'sticker': return '😀 ส่งสติกเกอร์';
      case 'location': return '📍 ส่งตำแหน่ง';
      case 'flex': return '📋 Flex Message';
      default: return `[${message.message_type}]`;
    }
  };

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 animate-slide-up">
      <button
        onClick={onClick}
        className="bg-white rounded-2xl shadow-lg border border-gray-200 
                   px-5 py-3 flex items-center gap-4 
                   hover:shadow-xl transition-all duration-200
                   min-w-[320px] max-w-[500px]"
      >
        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
          <FiChevronDown className="w-6 h-6 text-white" />
        </div>
        <div className="text-left min-w-0 flex-1">
          <p className="text-xs text-gray-500 font-medium mb-0.5">{senderName}</p>
          <p className="text-sm text-gray-800 truncate max-w-[350px]">
            {getPreview()}
          </p>
        </div>
        <span className="bg-red-500 text-white text-xs px-2.5 py-1 rounded-full flex-shrink-0 animate-pulse font-medium">
          ใหม่
        </span>
      </button>
    </div>
  );
}

export default function InboxPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // ✅ Current User state
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  
  // Tags state
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [conversationTags, setConversationTags] = useState<string[]>([]);
  
  // Quick Replies state
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showShortcutDropdown, setShowShortcutDropdown] = useState(false);
  const [filteredShortcuts, setFilteredShortcuts] = useState<QuickReply[]>([]);
  const [selectedShortcutIndex, setSelectedShortcutIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // SSE connection
  const eventSourceRef = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  const sseInitializedRef = useRef(false); // ✅ ป้องกัน multiple connections
  
  // Sync connectedRef with connected state
  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);
  
  // Image Modal state
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);

  // Emoji & Sticker Picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  
  // More Menu state
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // ============================================
  // Scroll & New Message Bubble State
  // ============================================
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingNewMessage, setPendingNewMessage] = useState<Message | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  
  // Notes & Assignment states
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');
  const [channelAdmins, setChannelAdmins] = useState<Admin[]>([]);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);
  const lastScrollTop = useRef(0);

  // ✅ File Upload states
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ Pending Flex Reply - เก็บ Flex Message ที่เลือกรอส่ง
  const [pendingFlexReply, setPendingFlexReply] = useState<QuickReply | null>(null);

  // Scroll to bottom function
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
    setPendingNewMessage(null);
  }, []);

  // ตรวจสอบว่าอยู่ใกล้ล่างสุดหรือไม่
  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    const threshold = 100;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // Handle scroll - ตรวจจับว่าผู้ใช้กำลังเลื่อนขึ้นหรือไม่
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    
    // ถ้าเลื่อนขึ้น (scroll position ลดลง) = กำลังดูข้อความเก่า
    if (currentScrollTop < lastScrollTop.current) {
      setIsUserScrolling(true);
      console.log('📜 User scrolling UP - isUserScrolling: true');
    }
    
    // ถ้าอยู่ใกล้ล่างสุด = หยุด scrolling mode
    if (isNearBottom()) {
      setIsUserScrolling(false);
      setPendingNewMessage(null);
      // console.log('📜 Near bottom - isUserScrolling: false');
    }
    
    lastScrollTop.current = currentScrollTop;
  }, [isNearBottom]);

  // Helper function สำหรับสร้าง preview
  const getMessagePreview = (message: any): string => {
    switch (message.message_type) {
      case 'text': return message.content || '';
      case 'image': return '[รูปภาพ]';
      case 'video': return '[วิดีโอ]';
      case 'audio': return '[เสียง]';
      case 'sticker': return '[สติกเกอร์]';
      case 'flex': return '[Flex Message]';
      case 'template': return '[Template]';
      case 'location': return '[ตำแหน่ง]';
      default: return `[${message.message_type}]`;
    }
  };

  // Ref สำหรับเก็บ selectedConversation ล่าสุด
  const selectedConversationRef = useRef<Conversation | null>(null);
  const isUserScrollingRef = useRef(false);
  const conversationsRef = useRef<Conversation[]>([]);
  
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    isUserScrollingRef.current = isUserScrolling;
  }, [isUserScrolling]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // ============================================
  // Notification Sound - With Enable Sound Banner
  // ============================================
  const audioContextRef = useRef<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showSoundBanner, setShowSoundBanner] = useState(true);
  const [showSoundConfirm, setShowSoundConfirm] = useState(false);

  // Enable sound when user clicks the banner
  const enableSound = useCallback(async () => {
    try {
      // สร้าง AudioContext
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume ถ้า suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // เล่นเสียงทดสอบ
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
      
      setSoundEnabled(true);
      setShowSoundBanner(false);
      setShowSoundConfirm(true);
      console.log('🔊 Sound enabled!');
      
      // ซ่อน confirm หลัง 2 วินาที
      setTimeout(() => setShowSoundConfirm(false), 2000);
      
      // Cleanup
      setTimeout(() => {
        oscillator.disconnect();
        gainNode.disconnect();
      }, 300);
    } catch (e) {
      console.log('Enable sound failed:', e);
    }
  }, []);

  // Hide banner after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSoundBanner(false);
    }, 15000);
    return () => clearTimeout(timer);
  }, []);

  const playNotificationSound = useCallback(async () => {
    if (!soundEnabled || !audioContextRef.current) {
      console.log('🔇 Sound not enabled yet');
      return;
    }
    
    try {
      const ctx = audioContextRef.current;
      
      // Resume ถ้า suspended
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      // เล่นเสียง notification (2 โทน)
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // เสียง 2 โทน
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1047, ctx.currentTime + 0.15);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.4);
      
      console.log('🔔 Notification sound played!');
      
      // Cleanup
      setTimeout(() => {
        oscillator.disconnect();
        gainNode.disconnect();
      }, 500);
      
    } catch (e) {
      console.log('Sound error:', e);
    }
  }, [soundEnabled]);

  const handleSSEEvent = useCallback((event: any) => {
    console.log('📥 SSE Event:', event.type);
    
    // Skip if no data
    if (!event.data) {
      return;
    }
    
    switch (event.type) {
      case 'new_message':
        // ตรวจสอบว่ามี message หรือไม่
        if (!event.data.message) {
          console.log('⏭️ Skipping - no message in data');
          return;
        }
        
        console.log('📨 new_message:', {
          conversation_id: event.data.conversation_id,
          direction: event.data.message?.direction,
          type: event.data.message?.message_type
        });
        
        const currentConv = selectedConversationRef.current;
        
        // เพิ่มข้อความใหม่ถ้าเป็น conversation ที่กำลังดูอยู่
        if (currentConv && event.data.conversation_id === currentConv.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === event.data.message.id)) {
              return prev;
            }
            return [...prev, event.data.message];
          });
          
          // ✅ ถ้าเป็นข้อความขาเข้า
          if (event.data.message.direction === 'incoming') {
            console.log('📨 Incoming message - isUserScrolling:', isUserScrollingRef.current);
            // ถ้าผู้ใช้กำลังดูข้อความเก่าอยู่ (ไม่อยู่ล่างสุด) → แสดง bubble
            if (isUserScrollingRef.current) {
              console.log('🔔 Showing NewMessageBubble!');
              setPendingNewMessage(event.data.message);
            } else {
              // อยู่ล่างสุดอยู่แล้ว → auto scroll
              setTimeout(() => scrollToBottom('smooth'), 50);
            }
            
            // Mark as read
            fetch(`/api/messages/conversations/${currentConv.id}/read`, { method: 'POST' })
              .catch(err => console.error('Mark as read error:', err));
          }
        }
        
        // ✅ เล่นเสียงและแสดง Browser Notification สำหรับข้อความขาเข้า
        if (event.data.message.direction === 'incoming') {
          const isViewingThis = currentConv?.id === event.data.conversation_id;
          
          // เล่นเสียงเมื่อไม่ได้ดู conversation นี้
          if (!isViewingThis) {
            console.log('🔊 Playing sound for new message...');
            playNotificationSound();
          }
          
          // แสดง Browser Notification เมื่อหน้าเว็บไม่ได้ focus หรือไม่ได้ดู conversation นี้
          const isPageVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
          if (!isPageVisible || !isViewingThis) {
            const convList = conversationsRef.current;
            const conv = convList.find(c => c.id === event.data.conversation_id);
            const senderName = conv?.line_user?.display_name || 'ข้อความใหม่';
            
            let messagePreview = '';
            switch (event.data.message.message_type) {
              case 'text':
                messagePreview = event.data.message.content?.substring(0, 50) || '';
                break;
              case 'image':
                messagePreview = '📷 ส่งรูปภาพ';
                break;
              case 'video':
                messagePreview = '🎬 ส่งวิดีโอ';
                break;
              case 'audio':
                messagePreview = '🎵 ส่งเสียง';
                break;
              case 'sticker':
                messagePreview = '😀 ส่งสติกเกอร์';
                break;
              case 'location':
                messagePreview = '📍 ส่งตำแหน่ง';
                break;
              default:
                messagePreview = `[${event.data.message.message_type}]`;
            }
            
            showBrowserNotification(senderName, messagePreview, conv?.line_user?.picture_url);
          }
        }
        break;
        
      case 'conversation_update':
        setConversations(prev => {
          const index = prev.findIndex(c => c.id === event.data.id);
          if (index >= 0) {
            const newConvs = [...prev];
            newConvs[index] = { 
              ...newConvs[index], 
              ...event.data,
              channel: event.data.channel || newConvs[index].channel,
              line_user: event.data.line_user || newConvs[index].line_user,
              tags: event.data.tags || newConvs[index].tags
            };
            return newConvs.sort((a, b) => 
              new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
            );
          }
          return prev;
        });
        
        const currentConvUpdate = selectedConversationRef.current;
        if (currentConvUpdate && currentConvUpdate.id === event.data.id) {
          setSelectedConversation(current => current ? { 
            ...current, 
            ...event.data,
            channel: event.data.channel || current.channel,
            line_user: event.data.line_user || current.line_user,
            tags: event.data.tags || current.tags
          } : null);
        }
        break;
        
      case 'new_conversation':
        setConversations(prev => {
          if (prev.some(c => c.id === event.data.id)) {
            return prev;
          }
          const newList = [event.data, ...prev];
          return newList.sort((a, b) => 
            new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
          );
        });
        
        // ✅ เล่นเสียงและแสดง notification สำหรับ conversation ใหม่
        playNotificationSound();
        
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
          const newConv = event.data;
          showBrowserNotification(
            '💬 แชทใหม่',
            newConv.line_user?.display_name || 'มีผู้ติดต่อใหม่',
            newConv.line_user?.picture_url
          );
        }
        break;
    }
  }, [scrollToBottom, playNotificationSound]);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectSSE = useCallback(() => {
    // ✅ ป้องกัน multiple connections
    if (sseInitializedRef.current && eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN) {
      console.log('SSE already connected, skipping...');
      return;
    }

    // ปิด connection เก่าถ้ามี
    if (eventSourceRef.current) {
      console.log('SSE Closing old connection...');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Clear pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    console.log('SSE Connecting...');
    sseInitializedRef.current = true;
    const eventSource = new EventSource('/api/sse');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE Connected ✅');
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(data);
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    eventSource.onerror = (e) => {
      console.log('SSE Error, will reconnect in 5s...');
      setConnected(false);
      
      // ปิด connection ที่ error
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      // ✅ Reconnect หลัง 5 วินาที (ใช้ ref เพื่อ clear ได้)
      reconnectTimeoutRef.current = setTimeout(() => {
        if (sseInitializedRef.current) {
          connectSSE();
        }
      }, 5000);
    };
  }, [handleSSEEvent]);

  // SSE Connection - connect ครั้งเดียวตอน mount
  useEffect(() => {
    // ✅ ป้องกัน double mount (React Strict Mode)
    if (sseInitializedRef.current) {
      console.log('SSE already initialized, skipping...');
      return;
    }
    
    connectSSE();
    
    return () => {
      console.log('SSE Cleanup...');
      sseInitializedRef.current = false;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================
  // Polling Fallback - ทำงานเฉพาะเมื่อ SSE หลุด
  // ============================================
  const lastCheckRef = useRef<Date>(new Date());
  const previousUnreadCountRef = useRef<number>(0);

  useEffect(() => {
    // ถ้า SSE เชื่อมต่ออยู่ ไม่ต้อง poll
    if (connected) {
      console.log('✅ SSE connected - Polling disabled');
      return;
    }

    console.log('⚠️ SSE disconnected - Polling enabled (every 30s)');

    const pollInterval = setInterval(async () => {
      // เช็คอีกครั้งว่า SSE กลับมา connect หรือยัง (ใช้ ref เพื่อให้ได้ค่าล่าสุด)
      if (connectedRef.current) {
        return;
      }

      try {
        // ดึง conversations ใหม่
        const res = await fetch('/api/messages/conversations');
        const data = await res.json();
        
        if (data.success && Array.isArray(data.data)) {
          const newConversations = data.data as Conversation[];
          
          // นับ unread ทั้งหมด
          const totalUnread = newConversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
          
          // ถ้ามี unread เพิ่มขึ้น = มีข้อความใหม่
          if (totalUnread > previousUnreadCountRef.current) {
            console.log(`📬 [Polling] New messages detected! Unread: ${previousUnreadCountRef.current} → ${totalUnread}`);
            
            // หา conversation ที่มี unread เพิ่ม
            const currentConv = selectedConversationRef.current;
            const isViewingUnread = currentConv && newConversations.find(
              c => c.id === currentConv.id && c.unread_count > 0
            );
            
            // ถ้าไม่ได้ดู conversation ที่มีข้อความใหม่ → เล่นเสียง + notification
            if (!isViewingUnread) {
              playNotificationSound();
              
              // หา conversation ที่มีข้อความใหม่ล่าสุด
              const newestConv = newConversations.find(c => c.unread_count > 0);
              if (newestConv && document.visibilityState !== 'visible') {
                showBrowserNotification(
                  newestConv.line_user?.display_name || 'ข้อความใหม่',
                  newestConv.last_message_preview || 'คุณมีข้อความใหม่',
                  newestConv.line_user?.picture_url
                );
              }
            }
          }
          
          previousUnreadCountRef.current = totalUnread;
          
          // อัพเดท conversations list
          setConversations(newConversations);
          
          // ถ้ากำลังดู conversation อยู่ ให้ดึงข้อความใหม่ด้วย
          const currentConv = selectedConversationRef.current;
          if (currentConv) {
            const updatedConv = newConversations.find(c => c.id === currentConv.id);
            if (updatedConv) {
              // ดึงข้อความใหม่
              const msgRes = await fetch(`/api/messages?conversation_id=${currentConv.id}`);
              const msgData = await msgRes.json();
              if (msgData.success) {
                const newMessages = msgData.data as Message[];
                const currentMessages = messages;
                
                // ถ้ามีข้อความใหม่
                if (newMessages.length > currentMessages.length) {
                  const latestMsg = newMessages[newMessages.length - 1];
                  
                  // ถ้าเป็นข้อความขาเข้าและไม่ได้ scroll อยู่ล่างสุด
                  if (latestMsg.direction === 'incoming' && isUserScrollingRef.current) {
                    setPendingNewMessage(latestMsg);
                  } else if (latestMsg.direction === 'incoming') {
                    setTimeout(() => scrollToBottom('smooth'), 50);
                  }
                  
                  setMessages(newMessages);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('[Polling] Error:', error);
      }
    }, 30000); // Poll ทุก 30 วินาที (เฉพาะเมื่อ SSE หลุด)

    return () => clearInterval(pollInterval);
  }, [connected, playNotificationSound, scrollToBottom, messages]);

  useEffect(() => {
    fetchChannels();
    fetchConversations();
    fetchTags();
    fetchCurrentUser(); // ✅ ดึงข้อมูล user ปัจจุบัน
    
    // ✅ ขอ permission สำหรับ Browser Notification
    requestNotificationPermission();
  }, []);

  // ✅ เมื่อเปลี่ยน conversation → scroll ลงล่างสุด
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      fetchQuickReplies(selectedConversation.channel_id);
      markAsRead(selectedConversation.id);
      setConversationTags(selectedConversation.tags?.map(t => t.id) || []);
      // Reset states
      setPendingNewMessage(null);
      setIsUserScrolling(false);
    }
  }, [selectedConversation?.id]);

  // ✅ Scroll ลงล่างสุดเมื่อโหลด messages เสร็จ (ครั้งแรกเข้า conversation)
  // Note: การ scroll หลักอยู่ใน fetchMessages แล้ว useEffect นี้เป็น fallback
  useEffect(() => {
    if (messages.length > 0 && selectedConversation) {
      // ใช้ setTimeout เพื่อให้ DOM render เสร็จก่อน
      const timer = setTimeout(() => {
        scrollToBottom('instant');
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [selectedConversation?.id]); // ✅ แก้ dependency - trigger เฉพาะตอนเปลี่ยน conversation

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

  // ✅ ดึงข้อมูล Current User
  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.data) {
        setCurrentUser({
          id: data.data.id,
          name: data.data.name,
          avatar: data.data.avatar
        });
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/messages/conversations');
      const data = await res.json();
      if (data.success) {
        setConversations(data.data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/messages?conversation_id=${conversationId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
        // ✅ Scroll to bottom หลังโหลด messages เสร็จ
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
          }
        }, 150);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchTags = async (channelId?: string) => {
    try {
      const url = channelId ? `/api/tags?channel_id=${channelId}` : '/api/tags';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setAllTags(data.data);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  // Fetch channel admins for assignment dropdown
  const fetchChannelAdmins = async (channelId: string) => {
    try {
      const res = await fetch(`/api/channels/${channelId}/admins`);
      const data = await res.json();
      if (data.success) {
        setChannelAdmins(data.data);
      }
    } catch (error) {
      console.error('Error fetching channel admins:', error);
    }
  };

  // Save conversation notes
  const saveNotes = async () => {
    if (!selectedConversation) return;
    
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/messages/conversations/${selectedConversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: editingNotes }),
      });
      const data = await res.json();
      if (data.success) {
        // Update local state
        setSelectedConversation({ ...selectedConversation, notes: editingNotes });
        setConversations(prev => prev.map(c => 
          c.id === selectedConversation.id ? { ...c, notes: editingNotes } : c
        ));
        setShowNotesModal(false);
      }
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setSavingNotes(false);
    }
  };

  // Assign conversation to admin
  const saveAssignedTo = async (adminId: string | null) => {
    if (!selectedConversation) return;
    
    setSavingAssign(true);
    try {
      const res = await fetch(`/api/messages/conversations/${selectedConversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: adminId }),
      });
      const data = await res.json();
      if (data.success) {
        const assignedAdmin = adminId ? channelAdmins.find(a => a.id === adminId) : undefined;
        setSelectedConversation({ ...selectedConversation, assigned_to: assignedAdmin });
        setConversations(prev => prev.map(c => 
          c.id === selectedConversation.id ? { ...c, assigned_to: assignedAdmin } : c
        ));
        setShowAssignModal(false);
      }
    } catch (error) {
      console.error('Error assigning conversation:', error);
    } finally {
      setSavingAssign(false);
    }
  };

  const fetchQuickReplies = async (channelId: string) => {
    try {
      const res = await fetch(`/api/quick-replies?channel_id=${channelId}`);
      const data = await res.json();
      if (data.success) {
        setQuickReplies(data.data);
      }
    } catch (error) {
      console.error('Error fetching quick replies:', error);
    }
  };

  const markAsRead = async (conversationId: string) => {
    try {
      await fetch(`/api/messages/conversations/${conversationId}/read`, {
        method: 'POST',
      });
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, status: 'read', unread_count: 0 } : c
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    setSendingMessage(true);
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          message_type: 'text',
          content: newMessage,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNewMessage('');
        fetchMessages(selectedConversation.id);
        fetchConversations();
        // ✅ หลังส่งข้อความ scroll ลงล่างสุดเสมอ
        setTimeout(() => scrollToBottom('smooth'), 150);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'ส่งข้อความไม่สำเร็จ',
          text: data.message || 'เกิดข้อผิดพลาด',
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถส่งข้อความได้',
      });
    } finally {
      setSendingMessage(false);
    }
  };

  // ✅ ส่ง Sticker
  const handleSendSticker = async (packageId: string, stickerId: string) => {
    if (!selectedConversation) return;

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          message_type: 'sticker',
          package_id: packageId,
          sticker_id: stickerId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        fetchMessages(selectedConversation.id);
        fetchConversations();
        setTimeout(() => scrollToBottom('smooth'), 150);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'ส่งสติกเกอร์ไม่สำเร็จ',
          text: data.message || 'เกิดข้อผิดพลาด',
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถส่งสติกเกอร์ได้',
      });
    }
  };

  // ✅ เพิ่ม Emoji เข้า input
  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  // ============================================
  // File Upload Handlers (Drag & Drop, Paste, Click)
  // ============================================
  
  // จัดการไฟล์ที่เลือก (จากทุกแหล่ง)
  const handleFilesSelected = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      // รองรับ image, video, audio
      if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
        return true;
      }
      return false;
    });

    if (validFiles.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ไฟล์ไม่รองรับ',
        text: 'รองรับเฉพาะไฟล์รูปภาพ, วิดีโอ และเสียง',
        timer: 2000,
        showConfirmButton: false,
      });
      return;
    }

    setPendingFiles(prev => [...prev, ...validFiles]);
  }, []);

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFilesSelected(files);
    }
  }, [handleFilesSelected]);

  // Paste handler (Ctrl+V)
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // สร้างชื่อไฟล์ใหม่
          const newFile = new File([file], `pasted-image-${Date.now()}.png`, { type: file.type });
          files.push(newFile);
        }
      }
    }

    if (files.length > 0) {
      handleFilesSelected(files);
      e.preventDefault();
    }
  }, [handleFilesSelected]);

  // เพิ่ม paste event listener
  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // ลบไฟล์ออกจาก pending
  const handleRemovePendingFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // อัพโหลดและส่งไฟล์
  const handleUploadAndSend = async () => {
    if (pendingFiles.length === 0 || !selectedConversation) return;

    setIsUploading(true);
    setUploadProgress(0);

    const totalFiles = pendingFiles.length;
    let uploadedCount = 0;
    let successCount = 0;

    try {
      for (const file of pendingFiles) {
        // อัพโหลดไฟล์
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        
        if (!uploadData.success) {
          console.error('Upload failed:', uploadData.message);
          uploadedCount++;
          setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
          continue;
        }

        // กำหนด message type
        let messageType = 'image';
        if (file.type.startsWith('video/')) messageType = 'video';
        else if (file.type.startsWith('audio/')) messageType = 'audio';

        // ส่งข้อความ
        const sendRes = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: selectedConversation.id,
            message_type: messageType,
            media_url: uploadData.data.url,
          }),
        });

        const sendData = await sendRes.json();
        if (sendData.success) {
          successCount++;
        }

        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
      }

      // แสดงผลลัพธ์
      if (successCount === totalFiles) {
        Swal.fire({
          icon: 'success',
          title: 'ส่งสำเร็จ!',
          text: `ส่ง ${successCount} ไฟล์เรียบร้อยแล้ว`,
          timer: 2000,
          showConfirmButton: false,
        });
      } else if (successCount > 0) {
        Swal.fire({
          icon: 'warning',
          title: 'ส่งบางส่วนสำเร็จ',
          text: `ส่งสำเร็จ ${successCount}/${totalFiles} ไฟล์`,
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'ส่งไม่สำเร็จ',
          text: 'ไม่สามารถส่งไฟล์ได้',
        });
      }

      // รีเฟรช
      fetchMessages(selectedConversation.id);
      fetchConversations();
      setTimeout(() => scrollToBottom('smooth'), 150);

    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error.message || 'ไม่สามารถอัพโหลดไฟล์ได้',
      });
    } finally {
      setPendingFiles([]);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // เดิม: handleImageUpload จาก input file
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedConversation) return;

    handleFilesSelected(files);
    e.target.value = '';
  };

  const updateConversationStatus = async (conversationId: string, status: string) => {
    try {
      await fetch(`/api/messages/conversations/${conversationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, status } : c
      ));
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(prev => prev ? { ...prev, status } : null);
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // ลบ conversation
  const deleteConversation = async (conversationId: string) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ',
      text: 'คุณต้องการลบการสนทนานี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/messages/conversations/${conversationId}`, {
          method: 'DELETE',
        });
        
        if (res.ok) {
          setConversations(prev => prev.filter(c => c.id !== conversationId));
          if (selectedConversation?.id === conversationId) {
            setSelectedConversation(null);
            setMessages([]);
          }
          Swal.fire({
            icon: 'success',
            title: 'ลบสำเร็จ',
            text: 'ลบการสนทนาเรียบร้อยแล้ว',
            timer: 1500,
            showConfirmButton: false
          });
        } else {
          throw new Error('Failed to delete');
        }
      } catch (error) {
        console.error('Error deleting conversation:', error);
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: 'ไม่สามารถลบการสนทนาได้'
        });
      }
    }
  };

  // ✅ Auto refresh profile (background - ไม่แสดง popup) รองรับทั้ง user และ group
  const autoRefreshProfile = async (conv: Conversation) => {
    if (!conv.line_user?.id) return;
    
    try {
      const res = await fetch('/api/messages/refresh-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_user_id: conv.line_user.id }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Update state เงียบๆ
        const updatedLineUser = {
          ...conv.line_user,
          display_name: data.data.display_name,
          picture_url: data.data.picture_url,
          // ถ้ามี member_count (group) ก็อัพเดทด้วย
          ...(data.data.member_count !== undefined && { member_count: data.data.member_count })
        };
        
        setSelectedConversation(prev => 
          prev?.id === conv.id ? { ...prev, line_user: updatedLineUser } : prev
        );
        
        setConversations(prev => prev.map(c => 
          c.id === conv.id ? { ...c, line_user: updatedLineUser } : c
        ));
      }
    } catch (error) {
      // Fail silently - ไม่ต้อง alert
      console.error('Auto refresh profile error:', error);
    }
  };

  // ✅ Handle select conversation with auto refresh
  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    // Auto refresh ทุกครั้งที่เลือก conversation (background)
    autoRefreshProfile(conv);
  };

  // Refresh LINE user profile
  const refreshUserProfile = async () => {
    if (!selectedConversation?.line_user?.id) return;
    
    try {
      const res = await fetch('/api/messages/refresh-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_user_id: selectedConversation.line_user.id }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Update local state
        const updatedLineUser = {
          ...selectedConversation.line_user,
          display_name: data.data.display_name,
          picture_url: data.data.picture_url,
          follow_status: 'following' as const,
          // ✅ อัพเดท member_count ถ้ามี (สำหรับ group)
          ...(data.data.member_count !== undefined && { member_count: data.data.member_count })
        };
        
        setSelectedConversation(prev => prev ? { 
          ...prev, 
          line_user: updatedLineUser 
        } : null);
        
        setConversations(prev => prev.map(c => 
          c.id === selectedConversation.id 
            ? { ...c, line_user: updatedLineUser } 
            : c
        ));
        
        // ✅ แสดงข้อความต่างกันสำหรับ group
        const isGroup = selectedConversation.line_user?.source_type === 'group';
        Swal.fire({
          icon: 'success',
          title: 'อัพเดทสำเร็จ',
          text: isGroup 
            ? `กลุ่ม: ${data.data.display_name} (${data.data.member_count} สมาชิก)`
            : `โปรไฟล์: ${data.data.display_name}`,
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'ไม่สามารถดึงโปรไฟล์ได้',
          text: data.message || 'ผู้ใช้อาจยกเลิกการติดตามแล้ว'
        });
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถดึงโปรไฟล์ได้'
      });
    }
  };

  const handleTagToggle = async (tagId: string) => {
    if (!selectedConversation) return;
    
    const isSelected = conversationTags.includes(tagId);
    const newTags = isSelected 
      ? conversationTags.filter(id => id !== tagId)
      : [...conversationTags, tagId];
    
    setConversationTags(newTags);
    
    try {
      await fetch(`/api/messages/conversations/${selectedConversation.id}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_ids: newTags }),
      });
      
      const selectedTags = allTags.filter(t => newTags.includes(t.id));
      setSelectedConversation(prev => prev ? { ...prev, tags: selectedTags } : null);
      setConversations(prev => prev.map(c => 
        c.id === selectedConversation.id ? { ...c, tags: selectedTags } : c
      ));
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };

  const handleQuickReplySelect = async (reply: QuickReply) => {
    setShowQuickReplies(false);
    setShowShortcutDropdown(false);
    
    // ถ้าเป็น flex message → เก็บไว้รอส่ง (ไม่ส่งทันที)
    if (reply.message_type === 'flex' && reply.flex_content) {
      setPendingFlexReply(reply);
      // Clear text message ถ้ามี
      setNewMessage('');
    } else {
      // ถ้าเป็นข้อความธรรมดา ให้ใส่ใน textarea
      setNewMessage(reply.content);
      // Clear pending flex ถ้ามี
      setPendingFlexReply(null);
      inputRef.current?.focus();
    }
  };

  // ✅ ส่ง Pending Flex Reply
  const sendPendingFlexReply = async () => {
    if (!pendingFlexReply || !selectedConversation) return;
    
    setSendingMessage(true);
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          message_type: 'flex',
          content: pendingFlexReply.content,
          flex_content: pendingFlexReply.flex_content,
          alt_text: pendingFlexReply.content
        }),
      });

      const data = await res.json();
      if (data.success) {
        // เพิ่ม use_count
        fetch(`/api/quick-replies/${pendingFlexReply.id}`, { method: 'GET' });
        fetchMessages(selectedConversation.id);
        fetchConversations();
        setPendingFlexReply(null);
        setTimeout(() => scrollToBottom('smooth'), 150);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'ส่ง Flex Message ไม่สำเร็จ',
          text: data.message || 'เกิดข้อผิดพลาด',
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถส่ง Flex Message ได้',
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    if (value.startsWith('/')) {
      const searchTerm = value.substring(1).toLowerCase();
      const matches = quickReplies.filter(qr => 
        qr.shortcut && qr.shortcut.toLowerCase().startsWith(searchTerm)
      );
      setFilteredShortcuts(matches);
      setShowShortcutDropdown(matches.length > 0);
      setSelectedShortcutIndex(0);
    } else {
      setShowShortcutDropdown(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ถ้ามี shortcut dropdown
    if (showShortcutDropdown && filteredShortcuts.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedShortcutIndex(prev => 
          prev < filteredShortcuts.length - 1 ? prev + 1 : prev
        );
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedShortcutIndex(prev => prev > 0 ? prev - 1 : 0);
        return;
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleQuickReplySelect(filteredShortcuts[selectedShortcutIndex]);
        return;
      } else if (e.key === 'Escape') {
        setShowShortcutDropdown(false);
        return;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        handleQuickReplySelect(filteredShortcuts[selectedShortcutIndex]);
        return;
      }
    }
    
    // Enter = ส่งข้อความ/ไฟล์/Flex, Shift+Enter = ขึ้นบรรทัดใหม่
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // ถ้ามี pending flex → ส่ง flex
      if (pendingFlexReply) {
        sendPendingFlexReply();
        return;
      }
      
      // ถ้ามีไฟล์หรือข้อความ → ส่ง
      if (pendingFiles.length > 0 || newMessage.trim()) {
        (async () => {
          // ส่งไฟล์ก่อน (ถ้ามี)
          if (pendingFiles.length > 0) {
            await handleUploadAndSend();
          }
          // ส่งข้อความ (ถ้ามี)
          if (newMessage.trim()) {
            handleSendMessage(e as any);
          }
        })();
      }
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    if (filterChannel !== 'all' && String(conv.channel_id) !== filterChannel) return false;
    if (filterStatus !== 'all' && conv.status !== filterStatus) return false;
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return conv.line_user?.display_name?.toLowerCase().includes(search) ||
             conv.last_message_preview?.toLowerCase().includes(search);
    }
    return true;
  });

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Image Modal */}
      {imageModalUrl && (
        <ImageModal url={imageModalUrl} onClose={() => setImageModalUrl(null)} />
      )}
      
      {/* Sound Enable Banner */}
      {showSoundBanner && !soundEnabled && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <button
            onClick={enableSound}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full shadow-lg transition-all"
          >
            <FiBell className="w-4 h-4" />
            <span className="text-sm font-medium">คลิกเพื่อเปิดเสียงแจ้งเตือน</span>
          </button>
        </div>
      )}
      
      {/* Sound Status Indicator - shows briefly then fades */}
      {showSoundConfirm && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs shadow">
            <FiBell className="w-3 h-3" />
            เสียงเปิดแล้ว ✓
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && selectedConversation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FiFileText className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-lg">โน้ตภายใน</h3>
              </div>
              <button 
                onClick={() => setShowNotesModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <textarea
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="เพิ่มโน้ตสำหรับทีมงาน... (ลูกค้า LINE จะไม่เห็น)"
                className="w-full h-40 border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 โน้ตนี้เป็นข้อมูลภายในสำหรับทีมงาน ลูกค้าจะไม่เห็น
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowNotesModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
              >
                {savingNotes ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <FiCheck className="w-4 h-4" />
                    บันทึก
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && selectedConversation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FiUserCheck className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-lg">มอบหมายงาน</h3>
              </div>
              <button 
                onClick={() => setShowAssignModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              {/* Unassign option */}
              <button
                onClick={() => saveAssignedTo(null)}
                disabled={savingAssign}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                  !selectedConversation.assigned_to 
                    ? 'bg-purple-50 border-2 border-purple-500' 
                    : 'hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <FiX className="w-5 h-5 text-gray-500" />
                </div>
                <div className="text-left">
                  <div className="font-medium">ไม่มอบหมาย</div>
                  <div className="text-xs text-gray-500">ยกเลิกการมอบหมาย</div>
                </div>
              </button>
              
              {/* Admins list */}
              {channelAdmins.map(admin => (
                <button
                  key={admin.id}
                  onClick={() => saveAssignedTo(admin.id)}
                  disabled={savingAssign}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg mt-2 transition-all ${
                    selectedConversation.assigned_to?.id === admin.id 
                      ? 'bg-purple-50 border-2 border-purple-500' 
                      : 'hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {admin.avatar ? (
                    <img src={admin.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-medium">
                        {admin.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="text-left flex-1">
                    <div className="font-medium flex items-center gap-2">
                      {admin.name}
                      {admin.role === 'owner' && (
                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">Owner</span>
                      )}
                      {admin.role === 'admin' && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Admin</span>
                      )}
                    </div>
                  </div>
                  {selectedConversation.assigned_to?.id === admin.id && (
                    <FiCheck className="w-5 h-5 text-purple-500" />
                  )}
                </button>
              ))}
              
              {channelAdmins.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <FiUsers className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>ไม่พบแอดมินที่มีสิทธิ์เข้าถึง Channel นี้</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar - Conversation List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-900">Inbox</h1>
            <div className="flex items-center gap-2">
              {/* Sound indicator */}
              <button
                onClick={soundEnabled ? undefined : enableSound}
                className={`flex items-center gap-1 text-xs ${soundEnabled ? 'text-green-500' : 'text-gray-400 hover:text-green-500 cursor-pointer'}`}
                title={soundEnabled ? 'เสียงเปิดอยู่' : 'คลิกเพื่อเปิดเสียง'}
              >
                {soundEnabled ? <FiBell className="w-3 h-3" /> : <FiBellOff className="w-3 h-3" />}
              </button>
              <div className={`flex items-center gap-1 text-xs ${connected ? 'text-green-500' : 'text-red-500'}`}>
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                {connected ? 'Live' : 'Offline'}
              </div>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative mb-3">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="ค้นหา..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 py-2"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="input py-2 text-sm flex-1"
            >
              <option value="all">ทุกเพจ</option>
              {channels.map(ch => (
                <option key={ch.id} value={String(ch.id)}>{ch.channel_name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input py-2 text-sm flex-1"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="unread">ยังไม่อ่าน</option>
              <option value="read">อ่านแล้ว</option>
              <option value="processing">กำลังดำเนินการ</option>
              <option value="completed">เสร็จสิ้น</option>
              <option value="spam">Spam</option>
            </select>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FiInbox className="w-12 h-12 mb-4 text-gray-300" />
              <p>ไม่มีการสนทนา</p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''} ${conv.status === 'unread' ? 'unread' : ''}`}
              >
                <div className="relative flex-shrink-0">
                  {conv.line_user?.picture_url ? (
                    <img
                      src={conv.line_user.picture_url}
                      alt={conv.line_user.display_name || 'User'}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      {/* ✅ แสดง icon ต่างกันสำหรับ group/room/user */}
                      {conv.line_user?.source_type === 'group' ? (
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      ) : conv.line_user?.source_type === 'room' ? (
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      ) : (
                        <FiUser className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  )}
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
                  )}
                  {/* ✅ แสดง badge กลุ่มที่มุมขวาล่าง */}
                  {(conv.line_user?.source_type === 'group' || conv.line_user?.source_type === 'room') && (
                    <span className="absolute -bottom-0.5 -right-0.5 bg-blue-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {conv.line_user?.member_count && conv.line_user.member_count > 0 
                        ? (conv.line_user.member_count > 99 ? '99+' : conv.line_user.member_count)
                        : 'G'}
                    </span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`font-medium truncate ${conv.status === 'unread' ? 'text-gray-900' : 'text-gray-700'}`}>
                        {conv.line_user?.display_name || 'Unknown'}
                      </span>
                      {/* ✅ แสดง icon กลุ่มข้างชื่อ */}
                      {conv.line_user?.source_type === 'group' && (
                        <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {conv.last_message_at && formatThaiTime(conv.last_message_at)}
                    </span>
                  </div>
                  
                  {/* Channel & Tags */}
                  <div className="flex items-center gap-1 mb-1 flex-wrap">
                    <span key={`channel-${conv.id}`} className="tag bg-green-100 text-green-700 text-xs">
                      {conv.channel?.channel_name}
                    </span>
                    {conv.tags?.slice(0, 2).map(tag => (
                      <span 
                        key={`tag-${tag.id}`} 
                        className="tag text-xs text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                  
                  <p className={`text-sm truncate ${conv.status === 'unread' ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                    {conv.last_message_preview || 'ไม่มีข้อความ'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div 
        className="flex-1 flex flex-col bg-gray-50 relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag & Drop Overlay */}
        {isDragging && selectedConversation && (
          <div className="absolute inset-0 z-50 bg-green-500/20 border-4 border-dashed border-green-500 flex items-center justify-center backdrop-blur-sm">
            <div className="text-center">
              <FiImage className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <p className="text-xl font-semibold text-green-700">วางไฟล์ที่นี่</p>
              <p className="text-sm text-green-600 mt-1">รองรับ รูปภาพ, วิดีโอ และเสียง</p>
            </div>
          </div>
        )}

        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {selectedConversation.line_user?.picture_url ? (
                  <img
                    src={selectedConversation.line_user.picture_url}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    {/* ✅ แสดง icon ต่างกันสำหรับ group/user */}
                    {selectedConversation.line_user?.source_type === 'group' ? (
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    ) : (
                      <FiUser className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900">
                      {selectedConversation.line_user?.display_name || 'Unknown'}
                    </h2>
                    {/* ✅ แสดง badge กลุ่ม */}
                    {selectedConversation.line_user?.source_type === 'group' && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium">
                        กลุ่ม
                      </span>
                    )}
                    {selectedConversation.line_user?.source_type === 'room' && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium">
                        ห้อง
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span key="header-channel" className="tag bg-green-100 text-green-700 text-xs">
                      {selectedConversation.channel?.channel_name}
                    </span>
                    {/* ✅ แสดงจำนวนสมาชิกในกลุ่ม (clickable) */}
                    {/* ✅ แสดงจำนวนสมาชิกในกลุ่ม */}
                    {(selectedConversation.line_user?.source_type === 'group' || selectedConversation.line_user?.source_type === 'room') && 
                     selectedConversation.line_user?.member_count && selectedConversation.line_user.member_count > 0 && (
                      <span className="text-xs text-gray-500 flex items-center gap-1 px-1.5 py-0.5">
                        <FiUsers className="w-3 h-3" />
                        {selectedConversation.line_user.member_count} สมาชิก
                      </span>
                    )}
                    {/* ✅ Assigned indicator */}
                    {selectedConversation.assigned_to && (
                      <button
                        onClick={() => {
                          fetchChannelAdmins(selectedConversation.channel_id);
                          setShowAssignModal(true);
                        }}
                        className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex items-center gap-1 hover:bg-purple-200"
                        title={`มอบหมายให้: ${selectedConversation.assigned_to.name}`}
                      >
                        <FiUserCheck className="w-3 h-3" />
                        {selectedConversation.assigned_to.name}
                      </button>
                    )}
                    {/* ✅ Notes indicator */}
                    {selectedConversation.notes && (
                      <button
                        onClick={() => {
                          setEditingNotes(selectedConversation.notes || '');
                          setShowNotesModal(true);
                        }}
                        className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded flex items-center gap-1 hover:bg-amber-200"
                        title="มีโน้ต"
                      >
                        <FiFileText className="w-3 h-3" />
                        โน้ต
                      </button>
                    )}
                    {selectedConversation.tags?.map(tag => (
                      <span 
                        key={`header-tag-${tag.id}`} 
                        className="tag text-xs text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Refresh Profile Button */}
                <button 
                  onClick={refreshUserProfile}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  title="รีเฟรชโปรไฟล์ผู้ใช้"
                >
                  <FiRefreshCw className="w-5 h-5 text-gray-500" />
                </button>

                {/* Notes Button */}
                <button 
                  onClick={() => {
                    setEditingNotes(selectedConversation.notes || '');
                    setShowNotesModal(true);
                  }}
                  className={`p-2 hover:bg-gray-100 rounded-lg ${selectedConversation.notes ? 'text-amber-500' : ''}`}
                  title="โน้ตภายใน"
                >
                  <FiFileText className={`w-5 h-5 ${selectedConversation.notes ? 'text-amber-500' : 'text-gray-500'}`} />
                </button>

                {/* Assign Button */}
                <button 
                  onClick={() => {
                    fetchChannelAdmins(selectedConversation.channel_id);
                    setShowAssignModal(true);
                  }}
                  className={`p-2 hover:bg-gray-100 rounded-lg ${selectedConversation.assigned_to ? 'text-purple-500' : ''}`}
                  title="มอบหมายงาน"
                >
                  <FiUserCheck className={`w-5 h-5 ${selectedConversation.assigned_to ? 'text-purple-500' : 'text-gray-500'}`} />
                </button>
                
                {/* Tag Button */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      fetchTags(selectedConversation.channel_id);
                      setShowTagModal(!showTagModal);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    title="จัดการ Tags"
                  >
                    <FiTag className="w-5 h-5 text-gray-500" />
                  </button>
                  
                  {showTagModal && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowTagModal(false)} />
                      <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-96 overflow-y-auto">
                        {/* เลือก Tags สำหรับ Conversation */}
                        <div className="p-3 border-b border-gray-100">
                          <div className="font-medium text-gray-700 text-sm mb-2">เลือก Tags</div>
                          {allTags.length === 0 ? (
                            <div className="text-sm text-gray-500 py-2">ยังไม่มี Tags ใน Channel นี้</div>
                          ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {allTags.map(tag => (
                                <label
                                  key={tag.id}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={conversationTags.includes(tag.id)}
                                    onChange={() => handleTagToggle(tag.id)}
                                    className="rounded"
                                  />
                                  <span 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: tag.color }}
                                  />
                                  <span className="text-sm">{tag.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* จัดการ Tags ของ Channel */}
                        <div className="p-3">
                          <TagsManager 
                            channelId={selectedConversation.channel_id} 
                            onTagsChange={() => fetchTags(selectedConversation.channel_id)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                {/* More Menu Button */}
                <div className="relative">
                  <button 
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    title="ตัวเลือกเพิ่มเติม"
                  >
                    <FiMoreVertical className="w-5 h-5 text-gray-500" />
                  </button>
                  
                  {showMoreMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        {/* Status Section */}
                        <div className="px-3 py-2 border-b border-gray-100">
                          <p className="text-xs text-gray-500 mb-2">เปลี่ยนสถานะ</p>
                          <div className="flex flex-wrap gap-1">
                            {[
                              { value: 'unread', label: 'ยังไม่อ่าน', color: 'bg-blue-100 text-blue-700' },
                              { value: 'read', label: 'อ่านแล้ว', color: 'bg-gray-100 text-gray-700' },
                              { value: 'processing', label: 'กำลังดำเนินการ', color: 'bg-yellow-100 text-yellow-700' },
                              { value: 'completed', label: 'เสร็จสิ้น', color: 'bg-green-100 text-green-700' },
                            ].map(status => (
                              <button
                                key={status.value}
                                onClick={() => {
                                  updateConversationStatus(selectedConversation.id, status.value);
                                  setShowMoreMenu(false);
                                }}
                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                  selectedConversation.status === status.value 
                                    ? status.color + ' ring-2 ring-offset-1 ring-gray-400' 
                                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                }`}
                              >
                                {status.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="py-1">
                          <button
                            onClick={() => {
                              updateConversationStatus(selectedConversation.id, 'spam');
                              setShowMoreMenu(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                              selectedConversation.status === 'spam' 
                                ? 'bg-orange-50 text-orange-700' 
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <FiX className="w-4 h-4" />
                            {selectedConversation.status === 'spam' ? 'เป็น Spam อยู่แล้ว' : 'ทำเครื่องหมายเป็น Spam'}
                          </button>
                          
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              deleteConversation(selectedConversation.id);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                          >
                            <FiTrash2 className="w-4 h-4" />
                            ลบการสนทนา
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Container */}
            <div 
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-6 space-y-4 relative"
            >
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* ✅ แสดงรูปคนส่งในกลุ่ม (ไม่แสดงสำหรับ bot_reply) */}
                  {msg.direction === 'incoming' && msg.sender_info && msg.source_type !== 'bot_reply' && (
                    <div className="flex-shrink-0 mr-2">
                      {msg.sender_info.picture_url ? (
                        <img 
                          src={msg.sender_info.picture_url} 
                          alt="" 
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <FiUser className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`chat-bubble ${msg.direction === 'outgoing' ? 'chat-bubble-outgoing' : 'chat-bubble-incoming'} max-w-[70%]`}>
                    {/* ✅ แสดงชื่อคนส่งในกลุ่ม LINE (ไม่แสดงสำหรับ bot_reply) */}
                    {msg.direction === 'incoming' && msg.sender_info?.display_name && msg.source_type !== 'bot_reply' && (
                      <div className="text-xs text-blue-600 font-medium mb-1">
                        {msg.sender_info.display_name}
                      </div>
                    )}
                    {/* ✅ แสดงชื่อ Admin ที่ตอบ (เฉพาะถ้าไม่ใช่ตัวเองตอบ และไม่ใช่ bot) */}
                    {msg.direction === 'outgoing' && msg.sent_by && currentUser && msg.sent_by.id !== currentUser.id && msg.source_type !== 'bot_reply' && (
                      <div className="text-xs text-green-600 font-medium mb-1 flex items-center gap-1">
                        <FiUser className="w-3 h-3" />
                        ตอบโดย: {msg.sent_by.name}
                      </div>
                    )}
                    {/* Source type badge */}
                    {msg.source_type === 'bot_reply' && (
                      <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                        <FiZap className="w-3 h-3" /> Bot
                      </div>
                    )}
                    
                    {msg.message_type === 'text' && msg.content && (
                      <p className="whitespace-pre-wrap break-words">
                        <LinkifyText text={msg.content} />
                      </p>
                    )}
                    {msg.message_type === 'image' && msg.media_url && (
                      <img 
                        src={getMediaUrl(msg.media_url)} 
                        alt="Image" 
                        className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ maxWidth: '250px' }}
                        onClick={() => setImageModalUrl(getMediaUrl(msg.media_url)!)}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect fill="%23f3f4f6" width="200" height="150"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="14">รูปภาพไม่พร้อมใช้งาน</text></svg>';
                          target.style.cursor = 'default';
                          target.onclick = null;
                        }}
                      />
                    )}
                    {msg.message_type === 'video' && msg.media_url && (
                      <video 
                        src={getMediaUrl(msg.media_url)}
                        controls
                        className="max-w-full rounded-lg"
                        style={{ maxWidth: '250px' }}
                      />
                    )}
                    {msg.message_type === 'audio' && msg.media_url && (
                      <audio src={getMediaUrl(msg.media_url)} controls className="w-full" />
                    )}
                    {msg.message_type === 'sticker' && msg.sticker_id && (
                      <img 
                        src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${msg.sticker_id}/android/sticker.png`}
                        alt="Sticker"
                        className="w-24 h-24"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect fill="%23f3f4f6" width="96" height="96" rx="8"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="32">😀</text></svg>';
                        }}
                      />
                    )}
                    {msg.message_type === 'sticker' && !msg.sticker_id && (
                      <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-3xl">😀</span>
                      </div>
                    )}
                    {msg.message_type === 'location' && msg.content && (
                      <div className="bg-gray-50 p-2 rounded">
                        <div className="text-xs text-gray-500 mb-1">📍 ตำแหน่ง</div>
                        {(() => {
                          try {
                            const loc = JSON.parse(msg.content);
                            return (
                              <div>
                                {loc.title && <p className="font-medium text-sm">{loc.title}</p>}
                                {loc.address && <p className="text-xs text-gray-600">{loc.address}</p>}
                                {loc.latitude && loc.longitude && (
                                  <a 
                                    href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-500 hover:underline mt-1 block"
                                  >
                                    ดูบน Google Maps
                                  </a>
                                )}
                              </div>
                            );
                          } catch {
                            return <p className="text-sm">{msg.content}</p>;
                          }
                        })()}
                      </div>
                    )}
                    {(msg.message_type === 'flex' || msg.message_type === 'template') && msg.flex_content && (
                      <FlexMessageRenderer content={msg.flex_content} />
                    )}
                    {msg.message_type === 'template' && !msg.flex_content && (
                      <div className="bg-gray-100 p-2 rounded">
                        <div className="text-xs text-gray-500">[Template Message]</div>
                        {msg.content && <p className="text-sm mt-1">{msg.content}</p>}
                      </div>
                    )}
                    <div className={`text-xs mt-1 ${msg.direction === 'outgoing' ? 'text-green-100' : 'text-gray-400'}`}>
                      {formatMessageTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>

            {/* ✅ New Message Bubble - แสดงนอก messages container */}
            {pendingNewMessage && (
              <NewMessageBubble 
                message={pendingNewMessage}
                senderName={selectedConversation.line_user?.display_name || 'Unknown'}
                onClick={() => scrollToBottom('smooth')}
              />
            )}

            {/* Quick Replies Panel - อยู่นอก form เพื่อป้องกัน nested form */}
            {showQuickReplies && (
              <div className="bg-white border-t border-gray-200 px-4 pt-3">
                <QuickRepliesPanel
                  compact={true}
                  currentChannelId={selectedConversation?.channel_id}
                  onSelect={(reply) => {
                    handleQuickReplySelect(reply);
                    setShowQuickReplies(false);
                  }}
                  onClose={() => setShowQuickReplies(false)}
                />
              </div>
            )}

            {/* ⚠️ Warning Banner for Unknown/Unfollowed Users */}
            {selectedConversation && (!selectedConversation.line_user?.display_name || 
              selectedConversation.line_user?.display_name === 'Unknown' ||
              selectedConversation.line_user?.follow_status === 'unfollowed' ||
              selectedConversation.line_user?.follow_status === 'blocked') && (
              <div className="bg-amber-50 border-t border-amber-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-amber-700 font-medium">
                      {selectedConversation.line_user?.follow_status === 'unfollowed' 
                        ? 'ผู้ใช้นี้ยกเลิกการติดตามแล้ว'
                        : selectedConversation.line_user?.follow_status === 'blocked'
                        ? 'ผู้ใช้นี้ถูกบล็อก'
                        : 'ไม่สามารถดึงข้อมูลโปรไฟล์ผู้ใช้ได้'}
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      ไม่สามารถส่งข้อความไปยังผู้ใช้นี้ได้
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Message Input */}
            {selectedConversation && selectedConversation.line_user?.display_name && 
             selectedConversation.line_user?.display_name !== 'Unknown' &&
             selectedConversation.line_user?.follow_status !== 'unfollowed' &&
             selectedConversation.line_user?.follow_status !== 'blocked' ? (
            <form onSubmit={handleSendMessage} className={`bg-white ${!showQuickReplies ? 'border-t border-gray-200' : ''} p-4`}>
              
              {/* ✅ Pending Flex Message Preview */}
              {pendingFlexReply && (
                <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FiCode className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-700">
                        Flex Message: {pendingFlexReply.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingFlexReply(null)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <FiX className="w-3 h-3" />
                      ยกเลิก
                    </button>
                  </div>
                  <p className="text-xs text-purple-600">
                    กดปุ่ม "ส่ง" หรือ Enter เพื่อส่ง Flex Message
                  </p>
                </div>
              )}

              {/* ✅ File Preview Section */}
              {pendingFiles.length > 0 && (
                <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      ไฟล์ที่จะส่ง ({pendingFiles.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setPendingFiles([])}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      ลบทั้งหมด
                    </button>
                  </div>
                  
                  {/* File Grid - ขยายขนาด preview */}
                  <div className="grid grid-cols-3 gap-3">
                    {pendingFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        {/* Preview */}
                        {file.type.startsWith('image/') ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-48 object-cover rounded-lg border border-gray-200"
                          />
                        ) : file.type.startsWith('video/') ? (
                          <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                            <span className="text-4xl">🎬</span>
                          </div>
                        ) : (
                          <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                            <span className="text-4xl">🎵</span>
                          </div>
                        )}
                        
                        {/* File Name */}
                        <p className="text-xs text-gray-500 truncate mt-1" title={file.name}>
                          {file.name}
                        </p>
                        
                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => handleRemovePendingFile(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full 
                                     flex items-center justify-center opacity-0 group-hover:opacity-100 
                                     transition-opacity hover:bg-red-600 shadow-md"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  {/* Upload Progress */}
                  {isUploading && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">กำลังอัพโหลด...</span>
                        <span className="text-green-600 font-medium">{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Textarea on top */}
              <div className="relative mb-3">
                <textarea
                  ref={inputRef}
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  placeholder={`พิมพ์ข้อความ... (พิมพ์ / เพื่อใช้ทางลัด)\nEnter: ส่ง, Shift + Enter: ขึ้นบรรทัดใหม่\n📎 ลากไฟล์มาวาง หรือ Ctrl+V เพื่อวางรูป`}
                  rows={3}
                  className="input w-full py-3 px-4 resize-none min-h-[80px]"
                  style={{ lineHeight: '1.5' }}
                />
                
                {/* Shortcut Autocomplete Dropdown */}
                {showShortcutDropdown && filteredShortcuts.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
                    {filteredShortcuts.map((reply, index) => (
                      <button
                        key={reply.id}
                        type="button"
                        onClick={() => handleQuickReplySelect(reply)}
                        className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                          index === selectedShortcutIndex ? 'bg-green-50 border-l-2 border-green-500' : ''
                        }`}
                      >
                        <span className="text-green-600 font-mono text-sm">/{reply.shortcut}</span>
                        <span className="text-gray-700">{reply.title}</span>
                        <span className="text-gray-400 text-xs truncate flex-1 text-right">
                          {reply.content.length > 30 ? reply.content.substring(0, 30) + '...' : reply.content}
                        </span>
                      </button>
                    ))}
                    <div className="px-3 py-1 text-xs text-gray-400 border-t bg-gray-50">
                      ↑↓ เลือก • Enter/Tab ใช้งาน • Esc ปิด
                    </div>
                  </div>
                )}
              </div>
              
              {/* Buttons on bottom */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {/* Emoji Picker */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmojiPicker(!showEmojiPicker);
                        setShowStickerPicker(false);
                      }}
                      className={`p-2 hover:bg-gray-100 rounded-lg ${showEmojiPicker ? 'bg-gray-100' : ''}`}
                      title="Emoji"
                    >
                      <FiSmile className="w-5 h-5 text-gray-500" />
                    </button>
                    {showEmojiPicker && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                        <EmojiPicker 
                          onSelect={handleEmojiSelect} 
                          onClose={() => setShowEmojiPicker(false)} 
                        />
                      </>
                    )}
                  </div>

                  {/* File Upload (รองรับ image, video, audio) */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
                    title="แนบไฟล์ (รูปภาพ, วิดีโอ, เสียง) หรือลากมาวาง"
                  >
                    <FiPaperclip className="w-5 h-5 text-gray-500" />
                  </label>

                  {/* Quick Reply Button */}
                  <button
                    type="button"
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className={`p-2 hover:bg-gray-100 rounded-lg ${showQuickReplies ? 'bg-gray-100' : ''}`}
                    title="ข้อความตอบกลับ (พิมพ์ / เพื่อค้นหา)"
                  >
                    <FiMessageCircle className="w-5 h-5 text-gray-500" />
                  </button>

                  {/* Sticker Picker */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowStickerPicker(!showStickerPicker);
                        setShowEmojiPicker(false);
                      }}
                      className={`p-2 hover:bg-gray-100 rounded-lg ${showStickerPicker ? 'bg-gray-100' : ''}`}
                      title="LINE Sticker"
                    >
                      <span className="text-lg">🐻</span>
                    </button>
                    {showStickerPicker && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowStickerPicker(false)} />
                        <StickerPicker 
                          onSelect={handleSendSticker} 
                          onClose={() => setShowStickerPicker(false)} 
                        />
                      </>
                    )}
                  </div>
                </div>
                
                {/* Send Button - รวมส่งข้อความและไฟล์ */}
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    // ถ้ามี pending flex → ส่ง flex
                    if (pendingFlexReply) {
                      await sendPendingFlexReply();
                      return;
                    }
                    // ถ้ามีไฟล์ → ส่งไฟล์ก่อน
                    if (pendingFiles.length > 0) {
                      await handleUploadAndSend();
                    }
                    // ถ้ามีข้อความ → ส่งข้อความ
                    if (newMessage.trim()) {
                      handleSendMessage(e as any);
                    }
                  }}
                  disabled={(!newMessage.trim() && pendingFiles.length === 0 && !pendingFlexReply) || sendingMessage || isUploading}
                  className="btn btn-primary px-6 py-2"
                >
                  {sendingMessage || isUploading ? (
                    <div className="spinner w-5 h-5 border-white border-t-transparent" />
                  ) : (
                    <span className="font-medium">ส่ง</span>
                  )}
                </button>
              </div>
            </form>
            ) : selectedConversation && (
              /* Disabled Input State */
              <div className="bg-gray-100 border-t border-gray-200 p-4">
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  <FiX className="w-5 h-5" />
                  <span className="text-sm">ไม่สามารถส่งข้อความไปยังผู้ใช้นี้ได้</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <FiMessageCircle className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg">เลือกการสนทนาเพื่อเริ่มแชท</p>
          </div>
        )}
      </div>
      
      {/* CSS Animation */}
      <style jsx global>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}