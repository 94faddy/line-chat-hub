'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiCopy, FiCheck, FiSave } from 'react-icons/fi';
import Swal from 'sweetalert2';

export default function EditChannelPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    channel_name: '',
    channel_id: '',
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
        setFormData({
          channel_name: data.data.channel_name,
          channel_id: data.data.channel_id,
          channel_secret: '', // ไม่แสดง secret เดิม
          channel_access_token: '', // ไม่แสดง token เดิม
          status: data.data.status
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'ไม่พบ Channel',
          text: 'Channel นี้ไม่มีอยู่ในระบบ',
        }).then(() => router.push('/dashboard/channels'));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
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

      // เพิ่ม secret และ token เฉพาะเมื่อมีการกรอกใหม่
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

  const copyWebhookUrl = () => {
    const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://chat.bevchat.in'}/api/webhook/${formData.channel_id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-10 h-10 border-4" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/dashboard/channels" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
          <FiArrowLeft className="w-4 h-4" />
          กลับ
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">แก้ไข Channel</h1>
        <p className="text-gray-500 mt-1">อัพเดทข้อมูล LINE OA ของคุณ</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
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
            Channel ID
          </label>
          <input
            type="text"
            value={formData.channel_id}
            className="input bg-gray-50 font-mono"
            disabled
          />
          <p className="text-xs text-gray-500 mt-1">Channel ID ไม่สามารถแก้ไขได้</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Channel Secret (เว้นว่างหากไม่ต้องการเปลี่ยน)
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
            Channel Access Token (เว้นว่างหากไม่ต้องการเปลี่ยน)
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

        {/* Webhook URL */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Webhook URL
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
              onClick={copyWebhookUrl}
              className="btn btn-secondary px-3"
            >
              {copied ? <FiCheck className="w-4 h-4 text-green-500" /> : <FiCopy className="w-4 h-4" />}
            </button>
          </div>
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
      </form>
    </div>
  );
}
