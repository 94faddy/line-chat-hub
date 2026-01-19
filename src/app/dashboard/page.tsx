'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { 
  FiSearch, FiFilter, FiMoreVertical, FiSend, FiImage, 
  FiSmile, FiPaperclip, FiCheck, FiCheckCircle, FiX,
  FiTag, FiUser, FiMessageCircle, FiInbox, FiZap, FiPlus,
  FiTrash2, FiEdit2, FiBell
} from 'react-icons/fi';
import Swal from 'sweetalert2';
import { FlexMessageRenderer, LinkifyText } from '@/components/FlexMessageRenderer';

interface Channel {
  id: number;
  channel_name: string;
  picture_url?: string;
  basic_id?: string;
}

interface LineUser {
  id: number;
  display_name?: string;
  picture_url?: string;
  line_user_id: string;
}

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface QuickReply {
  id: number;
  title: string;
  shortcut?: string;
  message_type: string;
  content: string;
  media_url?: string;
  channel_id?: number;
}

interface Conversation {
  id: number;
  channel_id: number;
  line_user_id: number;
  status: string;
  last_message_preview?: string;
  last_message_at?: string;
  unread_count: number;
  channel: Channel;
  line_user: LineUser;
  tags?: Tag[];
}

interface Message {
  id: number;
  direction: 'incoming' | 'outgoing';
  message_type: string;
  content?: string;
  media_url?: string;
  sticker_id?: string;
  package_id?: string;
  flex_content?: string;
  source_type?: string;
  created_at: string;
}

// ฟังก์ชันแปลงเวลาเป็น Asia/Bangkok timezone แบบ relative
function formatThaiTime(dateString: string): string {
  // แปลงเป็น Date object และปรับเป็น local time
  const date = new Date(dateString);
  const now = new Date();
  
  // คำนวณเวลาที่ผ่านไป
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

export default function InboxPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [filterChannel, setFilterChannel] = useState<number | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tags state
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [conversationTags, setConversationTags] = useState<number[]>([]);
  
  // Quick Replies state
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showShortcutDropdown, setShowShortcutDropdown] = useState(false);
  const [filteredShortcuts, setFilteredShortcuts] = useState<QuickReply[]>([]);
  const [selectedShortcutIndex, setSelectedShortcutIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // SSE connection
  const eventSourceRef = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);

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
  
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  const handleSSEEvent = useCallback((event: any) => {
    console.log('📥 SSE Event:', event.type, event.data);
    
    switch (event.type) {
      case 'new_message':
        const currentConv = selectedConversationRef.current;
        
        // เพิ่มข้อความใหม่ถ้าเป็น conversation ที่กำลังดูอยู่ (ทุก status)
        if (currentConv && event.data.conversation_id === currentConv.id) {
          setMessages(prev => {
            // ตรวจสอบว่ามีข้อความนี้อยู่แล้วหรือไม่
            if (prev.some(m => m.id === event.data.message.id)) {
              return prev;
            }
            return [...prev, event.data.message];
          });
          
          // ถ้ากำลังดู conversation นี้อยู่และเป็นข้อความขาเข้า ให้ mark as read
          if (event.data.message.direction === 'incoming') {
            fetch(`/api/messages/conversations/${currentConv.id}/read`, { method: 'POST' })
              .catch(err => console.error('Mark as read error:', err));
          }
        }
        
        // Play notification sound เฉพาะข้อความขาเข้าและไม่ได้ดู conversation นี้อยู่
        if (event.data.message.direction === 'incoming') {
          const isViewingThis = currentConv?.id === event.data.conversation_id;
          if (!isViewingThis) {
            playNotificationSound();
          }
        }
        break;
        
      case 'conversation_update':
        // อัพเดท conversation ใน list (ใช้ข้อมูลจาก server รวมถึง unread_count)
        setConversations(prev => {
          const index = prev.findIndex(c => c.id === event.data.id);
          if (index >= 0) {
            const newConvs = [...prev];
            // Merge ข้อมูลใหม่จาก server (รวมถึง unread_count, status, last_message_preview)
            newConvs[index] = { 
              ...newConvs[index], 
              ...event.data,
              // รักษา nested objects
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
        
        // อัพเดท selectedConversation ถ้ากำลังดูอยู่
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
        // เพิ่ม conversation ใหม่เข้า list
        setConversations(prev => {
          // ตรวจสอบว่ามีอยู่แล้วหรือไม่
          if (prev.some(c => c.id === event.data.id)) {
            return prev;
          }
          const newList = [event.data, ...prev];
          return newList.sort((a, b) => 
            new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
          );
        });
        playNotificationSound();
        break;
    }
  }, []);

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('/api/sse');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE Connected');
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

    eventSource.onerror = () => {
      console.log('SSE Error, reconnecting...');
      setConnected(false);
      setTimeout(() => connectSSE(), 5000);
    };
  }, [handleSSEEvent]);

  // SSE Connection
  useEffect(() => {
    connectSSE();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connectSSE]);

  // Audio context สำหรับ notification sound
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  // Initialize audio on first user interaction
  useEffect(() => {
    const handleUserGesture = () => {
      initAudioContext();
      document.removeEventListener('click', handleUserGesture);
      document.removeEventListener('keydown', handleUserGesture);
    };
    
    document.addEventListener('click', handleUserGesture);
    document.addEventListener('keydown', handleUserGesture);
    
    return () => {
      document.removeEventListener('click', handleUserGesture);
      document.removeEventListener('keydown', handleUserGesture);
    };
  }, []);

  const playNotificationSound = () => {
    try {
      const audioContext = audioContextRef.current || initAudioContext();
      
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // ตั้งค่าเสียง
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      // ตั้งค่า volume และ fade out
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      // เล่นเสียง
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Audio not supported');
    }
  };

  useEffect(() => {
    fetchChannels();
    fetchConversations();
    fetchTags();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      fetchQuickReplies(selectedConversation.channel_id);
      markAsRead(selectedConversation.id);
      setConversationTags(selectedConversation.tags?.map(t => t.id) || []);
    }
  }, [selectedConversation]);

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

  const fetchMessages = async (conversationId: number) => {
    try {
      const res = await fetch(`/api/messages?conversation_id=${conversationId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags');
      const data = await res.json();
      if (data.success) {
        setAllTags(data.data);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchQuickReplies = async (channelId: number) => {
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

  const markAsRead = async (conversationId: number) => {
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.message);
      }

      const sendRes = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          message_type: 'image',
          media_url: uploadData.data.url,
        }),
      });

      const sendData = await sendRes.json();
      if (sendData.success) {
        fetchMessages(selectedConversation.id);
        fetchConversations();
      }
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'อัพโหลดรูปไม่สำเร็จ',
        text: error.message || 'เกิดข้อผิดพลาด',
      });
    }

    e.target.value = '';
  };

  const updateConversationStatus = async (conversationId: number, status: string) => {
    try {
      await fetch(`/api/messages/conversations/${conversationId}/status`, {
        method: 'PUT',
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

  const handleTagToggle = async (tagId: number) => {
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
        body: JSON.stringify({ tags: newTags }),
      });
      
      // อัพเดท conversation tags
      const selectedTags = allTags.filter(t => newTags.includes(t.id));
      setSelectedConversation(prev => prev ? { ...prev, tags: selectedTags } : null);
      setConversations(prev => prev.map(c => 
        c.id === selectedConversation.id ? { ...c, tags: selectedTags } : c
      ));
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };

  const handleQuickReplySelect = (reply: QuickReply) => {
    setNewMessage(reply.content);
    setShowQuickReplies(false);
    setShowShortcutDropdown(false);
    inputRef.current?.focus();
  };

  // Handle input change สำหรับ shortcut autocomplete
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    // ตรวจจับ "/" เพื่อแสดง shortcut dropdown
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

  // Handle keyboard navigation for shortcut dropdown
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showShortcutDropdown || filteredShortcuts.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedShortcutIndex(prev => 
        prev < filteredShortcuts.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedShortcutIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' && showShortcutDropdown) {
      e.preventDefault();
      handleQuickReplySelect(filteredShortcuts[selectedShortcutIndex]);
    } else if (e.key === 'Escape') {
      setShowShortcutDropdown(false);
    } else if (e.key === 'Tab' && showShortcutDropdown) {
      e.preventDefault();
      handleQuickReplySelect(filteredShortcuts[selectedShortcutIndex]);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    if (filterChannel !== 'all' && conv.channel_id !== filterChannel) return false;
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
      {/* Sidebar - Conversation List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-900">Inbox</h1>
            <div className={`flex items-center gap-1 text-xs ${connected ? 'text-green-500' : 'text-red-500'}`}>
              <FiBell className="w-3 h-3" />
              {connected ? 'Live' : 'Offline'}
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
              onChange={(e) => setFilterChannel(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="input py-2 text-sm flex-1"
            >
              <option value="all">ทุกเพจ</option>
              {channels.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.channel_name}</option>
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
                onClick={() => setSelectedConversation(conv)}
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
                      <FiUser className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-medium truncate ${conv.status === 'unread' ? 'text-gray-900' : 'text-gray-700'}`}>
                      {conv.line_user?.display_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {conv.last_message_at && formatThaiTime(conv.last_message_at)}
                    </span>
                  </div>
                  
                  {/* Channel & Tags */}
                  <div className="flex items-center gap-1 mb-1 flex-wrap">
                    <span className="tag bg-green-100 text-green-700 text-xs">
                      {conv.channel?.channel_name}
                    </span>
                    {conv.tags?.slice(0, 2).map(tag => (
                      <span 
                        key={tag.id} 
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
      <div className="flex-1 flex flex-col bg-gray-50">
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
                    <FiUser className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {selectedConversation.line_user?.display_name || 'Unknown'}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="tag bg-green-100 text-green-700 text-xs">
                      {selectedConversation.channel?.channel_name}
                    </span>
                    {selectedConversation.tags?.map(tag => (
                      <span 
                        key={tag.id} 
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
                <select
                  value={selectedConversation.status}
                  onChange={(e) => updateConversationStatus(selectedConversation.id, e.target.value)}
                  className="input py-1.5 text-sm"
                >
                  <option value="unread">ยังไม่อ่าน</option>
                  <option value="read">อ่านแล้ว</option>
                  <option value="processing">กำลังดำเนินการ</option>
                  <option value="completed">เสร็จสิ้น</option>
                  <option value="spam">Spam</option>
                </select>
                
                {/* Tag Button */}
                <div className="relative">
                  <button 
                    onClick={() => setShowTagModal(!showTagModal)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <FiTag className="w-5 h-5 text-gray-500" />
                  </button>
                  
                  {showTagModal && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowTagModal(false)} />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-20">
                        <div className="font-medium text-gray-700 px-2 py-1 mb-2">เลือก Tags</div>
                        {allTags.length === 0 ? (
                          <div className="text-sm text-gray-500 px-2 py-1">ยังไม่มี Tags</div>
                        ) : (
                          allTags.map(tag => (
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
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
                
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <FiMoreVertical className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`chat-bubble ${msg.direction === 'outgoing' ? 'chat-bubble-outgoing' : 'chat-bubble-incoming'} max-w-[70%]`}>
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
                        src={msg.media_url} 
                        alt="Image" 
                        className="max-w-full rounded-lg cursor-pointer"
                        style={{ maxWidth: '250px' }}
                        onClick={() => window.open(msg.media_url, '_blank')}
                        onError={(e) => {
                          // ถ้าโหลดรูปไม่ได้ ซ่อนรูป
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    )}
                    {msg.message_type === 'video' && msg.media_url && (
                      <video 
                        src={msg.media_url}
                        controls
                        className="max-w-full rounded-lg"
                        style={{ maxWidth: '250px' }}
                      />
                    )}
                    {msg.message_type === 'audio' && msg.media_url && (
                      <audio src={msg.media_url} controls className="w-full" />
                    )}
                    {msg.message_type === 'sticker' && (
                      <img 
                        src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${msg.sticker_id}/android/sticker.png`}
                        alt="Sticker"
                        className="w-24 h-24"
                      />
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
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="bg-white border-t border-gray-200 p-4">
              {/* Quick Replies Panel */}
              {showQuickReplies && quickReplies.length > 0 && (
                <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">ข้อความตอบกลับ</span>
                    <button 
                      type="button"
                      onClick={() => setShowQuickReplies(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map(reply => (
                      <button
                        key={reply.id}
                        type="button"
                        onClick={() => handleQuickReplySelect(reply)}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm hover:bg-gray-100 transition-colors"
                      >
                        {reply.shortcut ? `/${reply.shortcut}` : ''} {reply.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  <FiImage className="w-5 h-5 text-gray-500" />
                </label>
                
                {/* Quick Reply Button */}
                <button
                  type="button"
                  onClick={() => setShowQuickReplies(!showQuickReplies)}
                  className={`p-2 hover:bg-gray-100 rounded-lg ${showQuickReplies ? 'bg-gray-100' : ''}`}
                  title="ข้อความตอบกลับ (พิมพ์ / เพื่อค้นหา)"
                >
                  <FiZap className="w-5 h-5 text-gray-500" />
                </button>
                
                {/* Input with Shortcut Dropdown */}
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    placeholder="พิมพ์ข้อความ... (พิมพ์ / เพื่อใช้ทางลัด)"
                    className="input w-full py-3"
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
                
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sendingMessage}
                  className="btn btn-primary p-3"
                >
                  {sendingMessage ? (
                    <div className="spinner w-5 h-5 border-white border-t-transparent" />
                  ) : (
                    <FiSend className="w-5 h-5" />
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <FiMessageCircle className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg">เลือกการสนทนาเพื่อเริ่มแชท</p>
          </div>
        )}
      </div>
    </div>
  );
}