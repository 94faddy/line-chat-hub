'use client';

import { useEffect, useState } from 'react';
import { FiPlus, FiTrash2, FiMail, FiCheck, FiX, FiUser } from 'react-icons/fi';
import Swal from 'sweetalert2';

interface TeamMember {
  id: number;
  admin_id: number;
  admin_email: string;
  admin_name: string;
  channel_id: number | null;
  channel_name: string | null;
  permissions: any;
  status: string;
  invited_at: string;
  accepted_at: string | null;
}

interface Channel {
  id: number;
  channel_name: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    channel_id: '' as string | number,
    permissions: {
      can_reply: true,
      can_view_all: false,
      can_manage_tags: false,
      can_broadcast: false
    }
  });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchMembers();
    fetchChannels();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/team');
      const data = await res.json();
      if (data.success) {
        setMembers(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
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
      console.error('Error:', error);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'ส่งคำเชิญสำเร็จ',
          text: 'ระบบได้ส่งอีเมลเชิญไปยังผู้ใช้แล้ว',
        });
        setShowInviteModal(false);
        setInviteForm({
          email: '',
          channel_id: '',
          permissions: {
            can_reply: true,
            can_view_all: false,
            can_manage_tags: false,
            can_broadcast: false
          }
        });
        fetchMembers();
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
        text: 'ไม่สามารถส่งคำเชิญได้',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (member: TeamMember) => {
    const result = await Swal.fire({
      title: 'ยืนยันการยกเลิกสิทธิ์?',
      text: `ต้องการยกเลิกสิทธิ์ของ ${member.admin_name || member.admin_email} หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ยกเลิกสิทธิ์',
      cancelButtonText: 'ยกเลิก',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/team/${member.id}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          setMembers(members.filter(m => m.id !== member.id));
          Swal.fire({
            icon: 'success',
            title: 'ยกเลิกสิทธิ์สำเร็จ',
            showConfirmButton: false,
            timer: 1500,
          });
        }
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-10 h-10 border-4" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการทีม</h1>
          <p className="text-gray-500">เพิ่มสมาชิกเพื่อช่วยตอบแชท</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="btn btn-primary"
        >
          <FiPlus className="w-5 h-5 mr-2" />
          เชิญสมาชิก
        </button>
      </div>

      {/* Members List */}
      {members.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiUser className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">ยังไม่มีสมาชิกในทีม</h3>
          <p className="text-gray-500 mb-6">เชิญสมาชิกเพื่อช่วยตอบแชทจากลูกค้า</p>
          <button
            onClick={() => setShowInviteModal(true)}
            className="btn btn-primary"
          >
            <FiPlus className="w-5 h-5 mr-2" />
            เชิญสมาชิก
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สมาชิก</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สิทธิ์</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map(member => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <FiUser className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.admin_name || 'รอยืนยัน'}
                        </p>
                        <p className="text-sm text-gray-500">{member.admin_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="tag bg-green-100 text-green-700">
                      {member.channel_name || 'ทุก Channel'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {member.permissions?.can_reply && (
                        <span className="tag bg-blue-100 text-blue-700">ตอบแชท</span>
                      )}
                      {member.permissions?.can_broadcast && (
                        <span className="tag bg-purple-100 text-purple-700">Broadcast</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {member.status === 'active' ? (
                      <span className="badge badge-green">
                        <FiCheck className="w-3 h-3 mr-1" />
                        ใช้งาน
                      </span>
                    ) : member.status === 'pending' ? (
                      <span className="badge badge-yellow">
                        <FiMail className="w-3 h-3 mr-1" />
                        รอยืนยัน
                      </span>
                    ) : (
                      <span className="badge badge-gray">
                        <FiX className="w-3 h-3 mr-1" />
                        ยกเลิก
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleRevoke(member)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 animate-fade-in">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">เชิญสมาชิกใหม่</h2>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  อีเมล
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="email@example.com"
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Channel (ไม่ระบุ = ทุก Channel)
                </label>
                <select
                  value={inviteForm.channel_id}
                  onChange={(e) => setInviteForm({ ...inviteForm, channel_id: e.target.value })}
                  className="input"
                >
                  <option value="">ทุก Channel</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.channel_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สิทธิ์การใช้งาน
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={inviteForm.permissions.can_reply}
                      onChange={(e) => setInviteForm({
                        ...inviteForm,
                        permissions: { ...inviteForm.permissions, can_reply: e.target.checked }
                      })}
                      className="rounded text-line-green focus:ring-line-green"
                    />
                    <span className="text-sm">ตอบแชท</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={inviteForm.permissions.can_view_all}
                      onChange={(e) => setInviteForm({
                        ...inviteForm,
                        permissions: { ...inviteForm.permissions, can_view_all: e.target.checked }
                      })}
                      className="rounded text-line-green focus:ring-line-green"
                    />
                    <span className="text-sm">ดูแชททั้งหมด</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={inviteForm.permissions.can_manage_tags}
                      onChange={(e) => setInviteForm({
                        ...inviteForm,
                        permissions: { ...inviteForm.permissions, can_manage_tags: e.target.checked }
                      })}
                      className="rounded text-line-green focus:ring-line-green"
                    />
                    <span className="text-sm">จัดการ Tags</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={inviteForm.permissions.can_broadcast}
                      onChange={(e) => setInviteForm({
                        ...inviteForm,
                        permissions: { ...inviteForm.permissions, can_broadcast: e.target.checked }
                      })}
                      className="rounded text-line-green focus:ring-line-green"
                    />
                    <span className="text-sm">ส่ง Broadcast</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="btn btn-primary flex-1"
                >
                  {inviting ? (
                    <span className="flex items-center gap-2">
                      <div className="spinner w-4 h-4 border-white border-t-transparent" />
                      กำลังส่ง...
                    </span>
                  ) : (
                    'ส่งคำเชิญ'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
