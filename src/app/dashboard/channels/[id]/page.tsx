// src/app/dashboard/channels/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiCopy, FiCheck, FiSave, FiEye, FiEyeOff, FiExternalLink, FiRefreshCw } from 'react-icons/fi';
import Swal from 'sweetalert2';

interface ChannelPermissions {
  can_reply?: boolean;
  can_view_all?: boolean;
  can_broadcast?: boolean;
  can_manage_tags?: boolean;
  can_manage_channel?: boolean;
}

export default function EditChannelPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState({
    channel_secret: false,
    channel_access_token: false
  });
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [permissions, setPermissions] = useState<ChannelPermissions | null>(null);
  
  const [channelData, setChannelData] = useState({
    channel_name: '',
    channel_id: '',
    channel_secret: '',
    channel_access_token: '',
    webhook_url: '',
    basic_id: '',
    picture_url: '',
    status: 'active'
  });

  const [formData, setFormData] = useState({
    channel_name: '',
    channel_secret: '',
    channel_access_token: '',
    status: 'active'
  });

  useEffect(() => {
    fetchChannel();
  }, [params.id]);

  const fetchChannel = async () => {
    try {
      const res = await fetch(`/api/channels/${params.id}`);
      const data = await res.json();
      
      if (data.success) {
        setChannelData({
          channel_name: data.data.channel_name || '',
          channel_id: data.data.channel_id || '',
          channel_secret: data.data.channel_secret || '',
          channel_access_token: data.data.channel_access_token || '',
          webhook_url: data.data.webhook_url || '',
          basic_id: data.data.basic_id || '',
          picture_url: data.data.picture_url || '',
          status: data.data.status || 'active'
        });
        setFormData({
          channel_name: data.data.channel_name || '',
          channel_secret: '',
          channel_access_token: '',
          status: data.data.status || 'active'
        });
        setIsOwner(data.data.isOwner || false);
        setCanEdit(data.data.canEdit || false);
        setPermissions(data.data.permissions || null);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'ไม่พบ Channel',
          text: data.message || 'Channel นี้ไม่มีอยู่ในระบบ หรือคุณไม่มีสิทธิ์เข้าถึง',
        }).then(() => router.push('/dashboard/channels'));
      }
    } catch (error) {
      console.error('Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถโหลดข้อมูลได้',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      const res = await fetch(`/api/channels/${params.id}/refresh`, {
        method: 'POST',
      });

      const data = await res.json();

      if (data.success) {
        // อัพเดท state ด้วยข้อมูลใหม่
        setChannelData(prev => ({
          ...prev,
          basic_id: data.data.basic_id || prev.basic_id,
          picture_url: data.data.picture_url || prev.picture_url,
        }));

        Swal.fire({
          icon: 'success',
          title: 'อัพเดทข้อมูลสำเร็จ',
          html: `
            <div class="text-left text-sm">
              <p><strong>Basic ID:</strong> ${data.data.basic_id || '-'}</p>
              <p><strong>Display Name:</strong> ${data.data.display_name || '-'}</p>
            </div>
          `,
          timer: 3000,
          showConfirmButton: true,
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: data.message,
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถดึงข้อมูลจาก LINE API ได้',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData: any = {
        channel_name: formData.channel_name,
        status: formData.status
      };

      if (formData.channel_secret) {
        updateData.channel_secret = formData.channel_secret;
      }
      if (formData.channel_access_token) {
        updateData.channel_access_token = formData.channel_access_token;
      }

      const res = await fetch(`/api/channels/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ',
          showConfirmButton: false,
          timer: 1500,
        }).then(() => router.push('/dashboard/channels'));
      } else {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: data.message,
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถบันทึกได้',
      });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    
    Swal.fire({
      icon: 'success',
      title: `คัดลอก ${label} แล้ว`,
      timer: 1000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
    });
  };

  const maskToken = (token: string, showChars: number = 8) => {
    if (!token) return '';
    if (token.length <= showChars * 2) return '••••••••••';
    return token.substring(0, showChars) + '••••••••' + token.substring(token.length - showChars);
  };

  const getWebhookUrl = () => {
    const baseUrl = process.env.NEXT_PUBLIC_APIWEBHOOK || process.env.NEXT_PUBLIC_APP_URL || 'https://bevchat.pro';
    return `${baseUrl}/api/webhook/${channelData.channel_id}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-10 h-10 border-4" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard/channels" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
          <FiArrowLeft className="w-4 h-4" />
          กลับ
        </Link>
        <div className="flex items-center gap-4">
          {channelData.picture_url ? (
            <img 
              src={channelData.picture_url} 
              alt={channelData.channel_name}
              className="w-16 h-16 rounded-xl object-cover"
            />
          ) : (
            <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📱</span>
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{channelData.channel_name}</h1>
            <div className="flex items-center gap-2">
              <p className="text-gray-500">ตั้งค่า LINE Official Account</p>
              {!isOwner && (
                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Admin</span>
              )}
            </div>
          </div>
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2"
            title="ดึงข้อมูลใหม่จาก LINE"
          >
            <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'กำลังโหลด...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Channel Info Card */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">ข้อมูล Channel</h2>
          {(!channelData.basic_id || !channelData.picture_url) && (
            <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
              ⚠️ ข้อมูลไม่ครบ - กด Refresh เพื่อดึงข้อมูลจาก LINE
            </span>
          )}
        </div>
        
        <div className="space-y-4">
          {/* Channel ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Channel ID
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={channelData.channel_id}
                className="input flex-1 bg-gray-50 font-mono"
                readOnly
              />
              <button
                type="button"
                onClick={() => copyToClipboard(channelData.channel_id, 'Channel ID')}
                className="btn btn-secondary px-3"
              >
                {copied === 'Channel ID' ? <FiCheck className="w-4 h-4 text-green-500" /> : <FiCopy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Basic ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Basic ID (LINE ID)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={channelData.basic_id || '(ยังไม่มีข้อมูล - กด Refresh)'}
                className={`input flex-1 bg-gray-50 ${!channelData.basic_id ? 'text-gray-400 italic' : ''}`}
                readOnly
              />
              {channelData.basic_id && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(channelData.basic_id, 'Basic ID')}
                  className="btn btn-secondary px-3"
                >
                  {copied === 'Basic ID' ? <FiCheck className="w-4 h-4 text-green-500" /> : <FiCopy className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Channel Access Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Channel Access Token
            </label>
            <div className="flex items-center gap-2">
              <input
                type={showSecrets.channel_access_token ? 'text' : 'password'}
                value={showSecrets.channel_access_token ? channelData.channel_access_token : maskToken(channelData.channel_access_token)}
                className="input flex-1 bg-gray-50 font-mono text-sm"
                readOnly
              />
              <button
                type="button"
                onClick={() => setShowSecrets({ ...showSecrets, channel_access_token: !showSecrets.channel_access_token })}
                className="btn btn-secondary px-3"
                title={showSecrets.channel_access_token ? 'ซ่อน' : 'แสดง'}
              >
                {showSecrets.channel_access_token ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(channelData.channel_access_token, 'Access Token')}
                className="btn btn-secondary px-3"
              >
                {copied === 'Access Token' ? <FiCheck className="w-4 h-4 text-green-500" /> : <FiCopy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Channel Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Channel Secret
            </label>
            <div className="flex items-center gap-2">
              <input
                type={showSecrets.channel_secret ? 'text' : 'password'}
                value={showSecrets.channel_secret ? channelData.channel_secret : maskToken(channelData.channel_secret, 4)}
                className="input flex-1 bg-gray-50 font-mono"
                readOnly
              />
              <button
                type="button"
                onClick={() => setShowSecrets({ ...showSecrets, channel_secret: !showSecrets.channel_secret })}
                className="btn btn-secondary px-3"
                title={showSecrets.channel_secret ? 'ซ่อน' : 'แสดง'}
              >
                {showSecrets.channel_secret ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(channelData.channel_secret, 'Channel Secret')}
                className="btn btn-secondary px-3"
              >
                {copied === 'Channel Secret' ? <FiCheck className="w-4 h-4 text-green-500" /> : <FiCopy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Webhook URL */}
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <label className="block text-sm font-medium text-green-800 mb-2">
              🔗 Webhook URL (นำไปตั้งค่าที่ LINE Developers Console)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={getWebhookUrl()}
                className="input flex-1 bg-white text-sm font-mono"
                readOnly
              />
              <button
                type="button"
                onClick={() => copyToClipboard(getWebhookUrl(), 'Webhook URL')}
                className="btn btn-primary px-3"
              >
                {copied === 'Webhook URL' ? <FiCheck className="w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
              </button>
            </div>
            <a 
              href="https://developers.line.biz/console/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-900 mt-2"
            >
              เปิด LINE Developers Console <FiExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">แก้ไขข้อมูล</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ชื่อ Channel
            </label>
            <input
              type="text"
              value={formData.channel_name}
              onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Channel Secret ใหม่ <span className="text-gray-400">(เว้นว่างหากไม่ต้องการเปลี่ยน)</span>
            </label>
            <input
              type="password"
              value={formData.channel_secret}
              onChange={(e) => setFormData({ ...formData, channel_secret: e.target.value })}
              placeholder="กรอกใหม่หากต้องการเปลี่ยน"
              className="input font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Channel Access Token ใหม่ <span className="text-gray-400">(เว้นว่างหากไม่ต้องการเปลี่ยน)</span>
            </label>
            <textarea
              value={formData.channel_access_token}
              onChange={(e) => setFormData({ ...formData, channel_access_token: e.target.value })}
              placeholder="กรอกใหม่หากต้องการเปลี่ยน"
              className="input font-mono text-sm h-24"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              สถานะ
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="input"
            >
              <option value="active">ใช้งาน</option>
              <option value="inactive">ปิดใช้งาน</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Link href="/dashboard/channels" className="btn btn-secondary flex-1 justify-center">
              ยกเลิก
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1 justify-center"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="spinner w-4 h-4 border-white border-t-transparent" />
                  กำลังบันทึก...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <FiSave className="w-4 h-4" />
                  บันทึก
                </span>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}