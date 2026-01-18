'use client';

import { useEffect, useState } from 'react';
import { 
  FiZap, FiPlus, FiEdit2, FiTrash2, FiSearch, 
  FiToggleLeft, FiToggleRight, FiMessageSquare,
  FiAlertCircle, FiX
} from 'react-icons/fi';
import Swal from 'sweetalert2';

interface AutoReply {
  id: number;
  channel_id: number | null;
  channel_name?: string;
  keyword: string;
  match_type: 'exact' | 'contains' | 'starts_with' | 'regex';
  response_type: 'text' | 'image' | 'template';
  response_content: string;
  is_active: boolean;
  priority: number;
  created_at: string;
}

interface Channel {
  id: number;
  channel_name: string;
}

export default function AutoReplyPage() {
  const [autoReplies, setAutoReplies] = useState<AutoReply[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingReply, setEditingReply] = useState<AutoReply | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    channel_id: '',
    keyword: '',
    match_type: 'contains' as 'exact' | 'contains' | 'starts_with' | 'regex',
    response_type: 'text' as 'text' | 'image' | 'template',
    response_content: '',
    is_active: true,
    priority: 0
  });

  useEffect(() => {
    fetchAutoReplies();
    fetchChannels();
  }, []);

  const fetchAutoReplies = async () => {
    try {
      const res = await fetch('/api/auto-reply');
      const data = await res.json();
      if (data.success) {
        setAutoReplies(data.data);
      }
    } catch (error) {
      console.error('Error fetching auto replies:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingReply 
        ? `/api/auto-reply/${editingReply.id}`
        : '/api/auto-reply';
      
      const res = await fetch(url, {
        method: editingReply ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          channel_id: form.channel_id ? parseInt(form.channel_id) : null
        })
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: editingReply ? 'อัปเดตสำเร็จ' : 'เพิ่มสำเร็จ',
          text: editingReply ? 'อัปเดตคำตอบอัตโนมัติเรียบร้อยแล้ว' : 'เพิ่มคำตอบอัตโนมัติเรียบร้อยแล้ว',
          timer: 2000,
          showConfirmButton: false
        });
        setShowModal(false);
        resetForm();
        fetchAutoReplies();
      } else {
        throw new Error(data.error);
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

  const handleEdit = (reply: AutoReply) => {
    setEditingReply(reply);
    setForm({
      channel_id: reply.channel_id?.toString() || '',
      keyword: reply.keyword,
      match_type: reply.match_type,
      response_type: reply.response_type,
      response_content: reply.response_content,
      is_active: reply.is_active,
      priority: reply.priority
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ',
      text: 'คุณต้องการลบคำตอบอัตโนมัตินี้หรือไม่?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/auto-reply/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'ลบสำเร็จ',
            timer: 1500,
            showConfirmButton: false
          });
          fetchAutoReplies();
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

  const handleToggle = async (id: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/auto-reply/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      
      if (res.ok) {
        fetchAutoReplies();
      }
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const resetForm = () => {
    setEditingReply(null);
    setForm({
      channel_id: '',
      keyword: '',
      match_type: 'contains',
      response_type: 'text',
      response_content: '',
      is_active: true,
      priority: 0
    });
  };

  const filteredReplies = autoReplies.filter(reply => {
    const matchesSearch = reply.keyword.toLowerCase().includes(search.toLowerCase()) ||
                         reply.response_content.toLowerCase().includes(search.toLowerCase());
    const matchesChannel = filterChannel === 'all' || 
                          (filterChannel === 'global' && !reply.channel_id) ||
                          reply.channel_id?.toString() === filterChannel;
    return matchesSearch && matchesChannel;
  });

  const matchTypeLabels = {
    exact: 'ตรงทุกตัวอักษร',
    contains: 'มีคำนี้',
    starts_with: 'ขึ้นต้นด้วย',
    regex: 'Regular Expression'
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiZap className="text-line-green" />
            Auto Reply
          </h1>
          <p className="text-gray-500 mt-1">จัดการคำตอบอัตโนมัติตาม Keyword</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn btn-primary gap-2"
        >
          <FiPlus className="w-5 h-5" />
          เพิ่ม Auto Reply
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหา keyword หรือข้อความ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="input w-full sm:w-48"
          >
            <option value="all">ทุก Channel</option>
            <option value="global">Global (ทุก Channel)</option>
            {channels.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.channel_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner w-8 h-8 mx-auto mb-4" />
            <p className="text-gray-500">กำลังโหลด...</p>
          </div>
        ) : filteredReplies.length === 0 ? (
          <div className="p-8 text-center">
            <FiMessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">ยังไม่มีคำตอบอัตโนมัติ</p>
            <button
              onClick={() => setShowModal(true)}
              className="btn btn-primary mt-4"
            >
              <FiPlus className="w-4 h-4 mr-2" />
              เพิ่ม Auto Reply แรก
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">สถานะ</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Keyword</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">เงื่อนไข</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ข้อความตอบกลับ</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Channel</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReplies.map(reply => (
                  <tr key={reply.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggle(reply.id, reply.is_active)}
                        className={`${reply.is_active ? 'text-line-green' : 'text-gray-400'}`}
                      >
                        {reply.is_active ? (
                          <FiToggleRight className="w-6 h-6" />
                        ) : (
                          <FiToggleLeft className="w-6 h-6" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">
                        {reply.keyword}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {matchTypeLabels[reply.match_type]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 max-w-xs truncate">
                        {reply.response_content}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {reply.channel_name ? (
                        <span className="badge badge-info">{reply.channel_name}</span>
                      ) : (
                        <span className="badge badge-success">Global</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(reply)}
                          className="p-2 text-gray-500 hover:text-line-green hover:bg-gray-100 rounded-lg"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(reply.id)}
                          className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingReply ? 'แก้ไข Auto Reply' : 'เพิ่ม Auto Reply'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Channel */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel
                </label>
                <select
                  value={form.channel_id}
                  onChange={(e) => setForm({ ...form, channel_id: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Global (ใช้กับทุก Channel)</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.channel_name}</option>
                  ))}
                </select>
              </div>

              {/* Keyword */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keyword <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  className="input w-full"
                  placeholder="เช่น สวัสดี, ราคา, โปรโมชั่น"
                  required
                />
              </div>

              {/* Match Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เงื่อนไขการจับคู่
                </label>
                <select
                  value={form.match_type}
                  onChange={(e) => setForm({ ...form, match_type: e.target.value as any })}
                  className="input w-full"
                >
                  <option value="contains">มีคำนี้อยู่ในข้อความ</option>
                  <option value="exact">ตรงทุกตัวอักษร</option>
                  <option value="starts_with">ขึ้นต้นด้วยคำนี้</option>
                  <option value="regex">Regular Expression</option>
                </select>
              </div>

              {/* Response Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ข้อความตอบกลับ <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.response_content}
                  onChange={(e) => setForm({ ...form, response_content: e.target.value })}
                  className="input w-full"
                  rows={4}
                  placeholder="ข้อความที่จะตอบกลับอัตโนมัติ"
                  required
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ลำดับความสำคัญ
                </label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                  className="input w-full"
                  min="0"
                  placeholder="ตัวเลขมากกว่าจะทำงานก่อน"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ตัวเลขมากกว่าจะมีความสำคัญสูงกว่า (ทำงานก่อน)
                </p>
              </div>

              {/* Active */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 text-line-green rounded"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  เปิดใช้งาน
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn btn-secondary flex-1"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary flex-1"
                >
                  {saving ? 'กำลังบันทึก...' : (editingReply ? 'อัปเดต' : 'เพิ่ม')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}