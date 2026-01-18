'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiInfo, FiCopy, FiCheck, FiExternalLink } from 'react-icons/fi';
import Swal from 'sweetalert2';

export default function AddChannelPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    channel_name: '',
    channel_id: '',
    channel_secret: '',
    channel_access_token: ''
  });
  const [webhookUrl, setWebhookUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        setWebhookUrl(data.data.webhook_url);
        
        await Swal.fire({
          icon: 'success',
          title: 'เพิ่ม Channel สำเร็จ!',
          html: `
            <p class="mb-4">กรุณานำ Webhook URL ด้านล่างไปตั้งค่าที่ LINE Developers Console</p>
            <div class="bg-gray-100 p-3 rounded-lg text-sm text-left break-all">
              ${data.data.webhook_url}
            </div>
          `,
          confirmButtonColor: '#06C755',
        });
        
        router.push('/dashboard/channels');
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
        text: 'ไม่สามารถเพิ่ม Channel ได้',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyWebhookUrl = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard/channels" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
          <FiArrowLeft className="w-4 h-4" />
          กลับ
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">เพิ่ม LINE Official Account</h1>
        <p className="text-gray-500 mt-1">เชื่อมต่อ LINE OA ของคุณเพื่อรับและตอบแชทจากลูกค้า</p>
      </div>

      {/* Guide */}
      <div className="card p-4 mb-6 bg-blue-50 border-blue-100">
        <div className="flex gap-3">
          <FiInfo className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 mb-2">วิธีการเชื่อมต่อ LINE OA</p>
            <ol className="list-decimal ml-4 text-blue-700 space-y-1">
              <li>เข้าสู่ <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-900">LINE Developers Console <FiExternalLink className="inline w-3 h-3" /></a></li>
              <li>เลือก Provider และ Channel ที่ต้องการ (Messaging API)</li>
              <li>คัดลอก Channel ID, Channel secret และ Channel access token</li>
              <li>นำข้อมูลมากรอกในฟอร์มด้านล่าง</li>
              <li>หลังเพิ่มสำเร็จ นำ Webhook URL ไปตั้งค่าที่ LINE Developers Console</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ชื่อ Channel (สำหรับแสดงในระบบ)
          </label>
          <input
            type="text"
            value={formData.channel_name}
            onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
            placeholder="เช่น ร้านค้าออนไลน์"
            className="input"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Channel ID
          </label>
          <input
            type="text"
            value={formData.channel_id}
            onChange={(e) => setFormData({ ...formData, channel_id: e.target.value })}
            placeholder="เช่น 1234567890"
            className="input font-mono"
            required
          />
          <p className="text-xs text-gray-500 mt-1">หาได้จาก Basic settings ใน LINE Developers Console</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Channel Secret
          </label>
          <input
            type="password"
            value={formData.channel_secret}
            onChange={(e) => setFormData({ ...formData, channel_secret: e.target.value })}
            placeholder="Channel secret"
            className="input font-mono"
            required
          />
          <p className="text-xs text-gray-500 mt-1">หาได้จาก Basic settings ใน LINE Developers Console</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Channel Access Token (Long-lived)
          </label>
          <textarea
            value={formData.channel_access_token}
            onChange={(e) => setFormData({ ...formData, channel_access_token: e.target.value })}
            placeholder="Channel access token"
            className="input font-mono text-sm h-24"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            หาได้จาก Messaging API tab → กด Issue ที่ Channel access token
          </p>
        </div>

        {/* Webhook URL Preview */}
        {formData.channel_id && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook URL (นำไปตั้งค่าที่ LINE Developers Console)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={`${process.env.NEXT_PUBLIC_APP_URL || 'https://chat.bevchat.in'}/api/webhook/${formData.channel_id}`}
                className="input bg-white text-sm font-mono"
                readOnly
              />
              <button
                type="button"
                onClick={() => {
                  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://chat.bevchat.in'}/api/webhook/${formData.channel_id}`;
                  navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="btn btn-secondary px-3"
              >
                {copied ? <FiCheck className="w-4 h-4 text-green-500" /> : <FiCopy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Link href="/dashboard/channels" className="btn btn-secondary flex-1 justify-center">
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary flex-1 justify-center"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="spinner w-4 h-4 border-white border-t-transparent" />
                กำลังบันทึก...
              </span>
            ) : (
              'เพิ่ม Channel'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
