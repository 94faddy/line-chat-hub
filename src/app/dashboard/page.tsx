'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  FiMessageCircle, FiUsers, FiRadio, FiTrendingUp,
  FiArrowUpRight, FiArrowDownRight, FiInbox, FiZap,
  FiExternalLink, FiClock, FiCheckCircle, FiAlertCircle,
  FiBarChart2, FiPieChart, FiActivity
} from 'react-icons/fi';

interface DashboardStats {
  overview: {
    total_channels: number;
    total_users: number;
    total_conversations: number;
    active_conversations: number;
    total_messages: number;
    messages_in_period: number;
    new_users_in_period: number;
  };
  charts: {
    messages_by_day: {
      date: string;
      total: number;
      incoming: number;
      outgoing: number;
    }[];
  };
  top_channels: {
    id: string;
    name: string;
    message_count: number;
  }[];
  recent_conversations: {
    id: string;
    user_name: string;
    user_picture?: string;
    channel_name: string;
    last_message: string;
    last_message_at: string;
    status: string;
  }[];
  period: string;
}

const CHAT_DOMAIN = process.env.NEXT_PUBLIC_CHAT_DOMAIN || 'https://chat.bevchat.pro';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/dashboard/stats?period=${period}`);
      const data = await res.json();
      if (data.overview) {
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'เมื่อสักครู่';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} นาทีที่แล้ว`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ชั่วโมงที่แล้ว`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} วันที่แล้ว`;
    
    return date.toLocaleDateString('th-TH', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getMaxMessages = () => {
    if (!stats?.charts?.messages_by_day?.length) return 100;
    return Math.max(...stats.charts.messages_by_day.map(d => d.total), 10);
  };

  if (loading && !stats) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl p-6 h-32">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">ภาพรวมระบบ BevChat</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input px-4 py-2 text-sm"
          >
            <option value="7d">7 วันที่แล้ว</option>
            <option value="30d">30 วันที่แล้ว</option>
            <option value="90d">90 วันที่แล้ว</option>
            <option value="all">ทั้งหมด</option>
          </select>
          <a
            href={CHAT_DOMAIN}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary flex items-center gap-2"
          >
            <FiInbox className="w-5 h-5" />
            เปิด Inbox
            <FiExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Channels */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FiRadio className="w-6 h-6 text-blue-600" />
            </div>
            <Link href="/dashboard/channels" className="text-blue-600 hover:text-blue-700">
              <FiArrowUpRight className="w-5 h-5" />
            </Link>
          </div>
          <p className="text-gray-500 text-sm">LINE Channels</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {formatNumber(stats?.overview.total_channels || 0)}
          </p>
        </div>

        {/* Total Users */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <FiUsers className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-green-600 text-sm font-medium flex items-center gap-1">
              <FiArrowUpRight className="w-4 h-4" />
              +{formatNumber(stats?.overview.new_users_in_period || 0)}
            </div>
          </div>
          <p className="text-gray-500 text-sm">ผู้ใช้ทั้งหมด</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {formatNumber(stats?.overview.total_users || 0)}
          </p>
        </div>

        {/* Messages */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <FiMessageCircle className="w-6 h-6 text-purple-600" />
            </div>
            <div className="text-purple-600 text-sm font-medium">
              {formatNumber(stats?.overview.messages_in_period || 0)} ในช่วงนี้
            </div>
          </div>
          <p className="text-gray-500 text-sm">ข้อความทั้งหมด</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {formatNumber(stats?.overview.total_messages || 0)}
          </p>
        </div>

        {/* Active Conversations */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <FiActivity className="w-6 h-6 text-orange-600" />
            </div>
            <a
              href={CHAT_DOMAIN}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-600 hover:text-orange-700"
            >
              <FiExternalLink className="w-5 h-5" />
            </a>
          </div>
          <p className="text-gray-500 text-sm">การสนทนาที่เปิดอยู่</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {formatNumber(stats?.overview.active_conversations || 0)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            จากทั้งหมด {formatNumber(stats?.overview.total_conversations || 0)} การสนทนา
          </p>
        </div>
      </div>

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">สถิติข้อความ</h3>
              <p className="text-sm text-gray-500 mt-1">จำนวนข้อความรายวัน</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-600">ขาเข้า</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600">ขาออก</span>
              </div>
            </div>
          </div>
          
          {/* Simple Bar Chart */}
          <div className="h-64 flex items-end gap-1">
            {stats?.charts?.messages_by_day?.slice(-14).map((day, index) => {
              const maxVal = getMaxMessages();
              const incomingHeight = (day.incoming / maxVal) * 100;
              const outgoingHeight = (day.outgoing / maxVal) * 100;
              
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full flex gap-0.5 items-end h-48">
                    <div 
                      className="flex-1 bg-green-500 rounded-t transition-all group-hover:bg-green-600"
                      style={{ height: `${Math.max(incomingHeight, 2)}%` }}
                      title={`ขาเข้า: ${day.incoming}`}
                    />
                    <div 
                      className="flex-1 bg-blue-500 rounded-t transition-all group-hover:bg-blue-600"
                      style={{ height: `${Math.max(outgoingHeight, 2)}%` }}
                      title={`ขาออก: ${day.outgoing}`}
                    />
                  </div>
                  <span className="text-xs text-gray-400 transform -rotate-45 origin-center">
                    {new Date(day.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              );
            })}
            {(!stats?.charts?.messages_by_day || stats.charts.messages_by_day.length === 0) && (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <p>ยังไม่มีข้อมูล</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Channels */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Channel ยอดนิยม</h3>
            <Link href="/dashboard/channels" className="text-green-600 hover:text-green-700 text-sm">
              ดูทั้งหมด
            </Link>
          </div>
          <div className="space-y-4">
            {stats?.top_channels?.length ? (
              stats.top_channels.map((channel, index) => {
                const maxCount = stats.top_channels[0].message_count;
                const percentage = (channel.message_count / maxCount) * 100;
                
                return (
                  <div key={channel.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                          {channel.name}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatNumber(channel.message_count)} ข้อความ
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-gray-400 py-8">
                <FiBarChart2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>ยังไม่มีข้อมูล</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">การสนทนาล่าสุด</h3>
            <a
              href={CHAT_DOMAIN}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-600 hover:text-green-700 text-sm flex items-center gap-1"
            >
              เปิด Inbox
              <FiExternalLink className="w-4 h-4" />
            </a>
          </div>
          <div className="space-y-3">
            {stats?.recent_conversations?.length ? (
              stats.recent_conversations.map((conv) => (
                <a
                  key={conv.id}
                  href={`${CHAT_DOMAIN}?conversation=${conv.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0 overflow-hidden">
                    {conv.user_picture ? (
                      <img 
                        src={conv.user_picture} 
                        alt={conv.user_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <FiUsers className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {conv.user_name}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {formatDate(conv.last_message_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {conv.last_message || 'ไม่มีข้อความ'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {conv.channel_name}
                    </p>
                  </div>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    conv.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                </a>
              ))
            ) : (
              <div className="text-center text-gray-400 py-8">
                <FiMessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>ยังไม่มีการสนทนา</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">การดำเนินการด่วน</h3>
          <div className="grid grid-cols-2 gap-4">
            <a
              href={CHAT_DOMAIN}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-6 bg-green-50 hover:bg-green-100 rounded-xl transition-colors group"
            >
              <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FiInbox className="w-7 h-7 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-900">เปิด Inbox</span>
              <span className="text-xs text-gray-500 mt-1">ตอบข้อความลูกค้า</span>
            </a>

            <Link
              href="/dashboard/broadcast"
              className="flex flex-col items-center justify-center p-6 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors group"
            >
              <div className="w-14 h-14 bg-purple-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FiZap className="w-7 h-7 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-900">Broadcast</span>
              <span className="text-xs text-gray-500 mt-1">ส่งข้อความถึงทุกคน</span>
            </Link>

            <Link
              href="/dashboard/channels/add"
              className="flex flex-col items-center justify-center p-6 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors group"
            >
              <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FiRadio className="w-7 h-7 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-900">เพิ่ม Channel</span>
              <span className="text-xs text-gray-500 mt-1">เชื่อมต่อ LINE OA</span>
            </Link>

            <Link
              href="/dashboard/team"
              className="flex flex-col items-center justify-center p-6 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors group"
            >
              <div className="w-14 h-14 bg-orange-500 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FiUsers className="w-7 h-7 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-900">จัดการทีม</span>
              <span className="text-xs text-gray-500 mt-1">เชิญสมาชิกใหม่</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">พร้อมเริ่มตอบแชทลูกค้าแล้ว!</h3>
            <p className="text-green-100 mt-1">
              คุณมี {stats?.overview.active_conversations || 0} การสนทนาที่รอตอบ
            </p>
          </div>
          <a
            href={CHAT_DOMAIN}
            target="_blank"
            rel="noopener noreferrer"
            className="btn bg-white text-green-600 hover:bg-green-50 flex items-center gap-2 px-6"
          >
            <FiInbox className="w-5 h-5" />
            ไปที่ Inbox
            <FiExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}