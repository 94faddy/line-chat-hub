'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { 
  FiSearch, FiFilter, FiMoreVertical, FiSend, FiImage, 
  FiSmile, FiPaperclip, FiCheck, FiCheckCircle, FiX,
  FiTag, FiUser, FiMessageCircle, FiInbox
} from 'react-icons/fi';
import Swal from 'sweetalert2';

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
  tags?: { id: number; name: string; color: string }[];
}

interface Message {
  id: number;
  direction: 'incoming' | 'outgoing';
  message_type: string;
  content?: string;
  media_url?: string;
  sticker_id?: string;
  package_id?: string;
  created_at: string;
}

// ฟังก์ชันแปลงเวลาเป็น Asia/Bangkok timezone แบบ relative
function formatThaiTime(dateString: string): string {
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
    // แสดงวันที่แบบไทย
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
  
  // ตรวจสอบว่าเป็นวันเดียวกันหรือไม่
  const isToday = date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) === 
                  now.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
  
  // ตรวจสอบว่าเป็นเมื่อวานหรือไม่
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

  useEffect(() => {
    fetchChannels();
    fetchConversations();
    
    // Auto refresh conversations ทุก 10 วินาที
    const interval = setInterval(() => {
      fetchConversations();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      // Mark as read
      markAsRead(selectedConversation.id);
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

  const markAsRead = async (conversationId: number) => {
    try {
      await fetch(`/api/messages/conversations/${conversationId}/read`, {
        method: 'POST',
      });
      // Update local state
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
    formData.append('conversation_id', selectedConversation.id.toString());

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        // ส่งรูปภาพ
        await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: selectedConversation.id,
            message_type: 'image',
            media_url: data.data.url,
          }),
        });
        fetchMessages(selectedConversation.id);
        fetchConversations();
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถอัพโหลดรูปภาพได้',
      });
    }
  };

  const updateConversationStatus = async (conversationId: number, status: string) => {
    try {
      await fetch(`/api/messages/conversations/${conversationId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchConversations();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(conv => {
    if (filterChannel !== 'all' && conv.channel_id !== filterChannel) return false;
    if (filterStatus !== 'all' && conv.status !== filterStatus) return false;
    if (searchQuery) {
      const name = conv.line_user?.display_name?.toLowerCase() || '';
      const preview = conv.last_message_preview?.toLowerCase() || '';
      if (!name.includes(searchQuery.toLowerCase()) && !preview.includes(searchQuery.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner w-10 h-10 border-4" />
      </div>
    );
  }

  // ถ้าไม่มี Channel ให้แสดงหน้าเพิ่ม Channel
  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <FiMessageCircle className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">ยินดีต้อนรับ!</h2>
        <p className="text-gray-500 text-center mb-6 max-w-md">
          เริ่มต้นด้วยการเชื่อมต่อ LINE Official Account ของคุณ 
          เพื่อรับและตอบแชทจากลูกค้า
        </p>
        <a href="/dashboard/channels/add" className="btn btn-primary">
          เพิ่ม LINE OA
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Conversation List */}
      <div className="w-80 lg:w-96 border-r border-gray-200 bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900 mb-4">Inbox</h1>
          
          {/* Search */}
          <div className="relative mb-3">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
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
                  
                  {/* Channel Tag */}
                  <div className="flex items-center gap-1 mb-1">
                    <span className="tag bg-green-100 text-green-700">
                      {conv.channel?.channel_name}
                    </span>
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
                    <span className="tag bg-green-100 text-green-700">
                      {selectedConversation.channel?.channel_name}
                    </span>
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
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <FiTag className="w-5 h-5 text-gray-500" />
                </button>
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
                  <div className={`chat-bubble ${msg.direction === 'outgoing' ? 'chat-bubble-outgoing' : 'chat-bubble-incoming'}`}>
                    {msg.message_type === 'text' && (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.message_type === 'image' && msg.media_url && (
                      <img 
                        src={msg.media_url} 
                        alt="Image" 
                        className="max-w-xs rounded-lg"
                      />
                    )}
                    {msg.message_type === 'sticker' && (
                      <div className="text-4xl">🎉</div>
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
                
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="พิมพ์ข้อความ..."
                  className="input flex-1 py-3"
                />
                
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