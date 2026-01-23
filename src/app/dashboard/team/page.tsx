// src/app/dashboard/team/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { FiPlus, FiTrash2, FiCheck, FiX, FiUser, FiLink, FiCopy, FiClock, FiEdit2, FiShield } from 'react-icons/fi';
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({
    channel_id: '' as string | number,
    permissions: {
      can_reply: true,
      can_view_all: false,
      can_broadcast: false,
      can_manage_channel: false
    }
  });
  const [editForm, setEditForm] = useState({
    channel_id: '' as string | number,
    permissions: {
      can_reply: true,
      can_view_all: false,
      can_broadcast: false,
      can_manage_channel: false
    }
  });
  const [inviting, setInviting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMembers();
    fetchChannels();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/team');
      const data = await res.json();
      if (data.success) {
        const filtered = data.data.filter((m: TeamMember) => {
          return m.status === 'active' || (m.status === 'pending' && m.admin_name);
        });
        setMembers(filtered);
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

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteLink(null);

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: inviteForm.channel_id || null,
          permissions: inviteForm.permissions,
        }),
      });

      const data = await res.json();

      if (data.success && data.data?.invite_url) {
        setInviteLink(data.data.invite_url);
        Swal.fire({
          icon: 'success',
          title: 'สร้างลิงก์เชิญสำเร็จ',
          text: 'คัดลอกลิงก์ด้านล่างเพื่อส่งให้สมาชิก',
          timer: 2000,
          showConfirmButton: false,
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
        text: 'ไม่สามารถสร้างลิงก์ได้',
      });
    } finally {
      setInviting(false);
    }
  };

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      Swal.fire({
        icon: 'success',
        title: 'คัดลอกแล้ว',
        timer: 1000,
        showConfirmButton: false,
        position: 'top-end',
        toast: true,
      });
    }
  };

  const resetInviteForm = () => {
    setInviteForm({
      channel_id: '',
      permissions: {
        can_reply: true,
        can_view_all: false,
        can_broadcast: false,
        can_manage_channel: false
      }
    });
    setInviteLink(null);
  };

  const handleEdit = (member: TeamMember) => {
    setEditingMember(member);
    setEditForm({
      channel_id: member.channel_id?.toString() || '',
      permissions: {
        can_reply: member.permissions?.can_reply ?? true,
        can_view_all: member.permissions?.can_view_all ?? false,
        can_broadcast: member.permissions?.can_broadcast ?? false,
        can_manage_channel: member.permissions?.can_manage_channel ?? false
      }
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    
    setSaving(true);

    try {
      const res = await fetch(`/api/team/${editingMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: editForm.channel_id || null,
          permissions: editForm.permissions,
        }),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'อัปเดตสิทธิ์สำเร็จ',
          timer: 1500,
          showConfirmButton: false,
        });
        setShowEditModal(false);
        setEditingMember(null);
        fetchMembers();
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error.message || 'ไม่สามารถอัปเดตได้',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (member: TeamMember) => {
    const result = await Swal.fire({
      title: 'ยืนยันการยกเลิกสิทธิ์?',
      text: `ต้องการยกเลิกสิทธิ์ของ ${member.admin_name || member.admin_email || 'สมาชิก'} หรือไม่?`,
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
          <p className="text-gray-500">เชิญสมาชิกและกำหนดสิทธิ์การเข้าถึง</p>
        </div>
        <button
          onClick={() => {
            resetInviteForm();
            setShowInviteModal(true);
          }}
          className="btn btn-primary"
        >
          <FiPlus className="w-5 h-5 mr-2" />
          สร้างลิงก์เชิญ
        </button>
      </div>

      {/* Team Members */}
      {members.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiUser className="w-10 h-10 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">ยังไม่มีสมาชิกในทีม</h3>
          <p className="text-gray-500 mb-6">สร้างลิงก์เชิญเพื่อเพิ่มสมาชิกใหม่</p>
          <button
            onClick={() => {
              resetInviteForm();
              setShowInviteModal(true);
            }}
            className="btn btn-primary"
          >
            <FiLink className="w-5 h-5 mr-2" />
            สร้างลิงก์เชิญ
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สมาชิก
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Channel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สิทธิ์
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สถานะ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <FiUser className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {member.admin_name || 'รอยืนยัน'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {member.admin_email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {member.channel_name || 'ทุก Channel'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {member.permissions?.can_reply && (
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">ตอบแชท</span>
                      )}
                      {member.permissions?.can_view_all && (
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">ดูทั้งหมด</span>
                      )}
                      {member.permissions?.can_broadcast && (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Broadcast</span>
                      )}
                      {member.permissions?.can_manage_channel && (
                        <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">ตั้งค่า Channel</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {member.status === 'active' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <FiCheck className="w-3 h-3 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <FiClock className="w-3 h-3 mr-1" />
                        รอยืนยัน
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(member)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="แก้ไขสิทธิ์"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRevoke(member)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="ยกเลิกสิทธิ์"
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

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FiLink className="w-5 h-5 text-green-500" />
                สร้างลิงก์เชิญสมาชิก
              </h2>
              <p className="text-sm text-gray-500 mt-1">สร้างลิงก์เพื่อส่งให้สมาชิกใหม่</p>
            </div>
            
            <form onSubmit={handleCreateInvite} className="p-6 space-y-4">
              {inviteLink && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-green-800 mb-2">
                    🔗 ลิงก์เชิญ (ส่งให้สมาชิก)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="input flex-1 bg-white text-sm"
                    />
                    <button
                      type="button"
                      onClick={copyInviteLink}
                      className="btn btn-primary px-3"
                    >
                      <FiCopy className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    ลิงก์นี้มีอายุ 7 วัน ใครก็ตามที่มีลิงก์สามารถรับคำเชิญได้
                  </p>
                </div>
              )}

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
                  <PermissionCheckbox
                    label="ตอบแชท"
                    description="สามารถตอบข้อความลูกค้าได้"
                    checked={inviteForm.permissions.can_reply}
                    onChange={(checked) => setInviteForm({
                      ...inviteForm,
                      permissions: { ...inviteForm.permissions, can_reply: checked }
                    })}
                  />
                  <PermissionCheckbox
                    label="ดูแชททั้งหมด"
                    description="สามารถดูแชททุกการสนทนาได้"
                    checked={inviteForm.permissions.can_view_all}
                    onChange={(checked) => setInviteForm({
                      ...inviteForm,
                      permissions: { ...inviteForm.permissions, can_view_all: checked }
                    })}
                  />
                  <PermissionCheckbox
                    label="ส่ง Broadcast"
                    description="สามารถส่งข้อความไปยังลูกค้าทั้งหมดได้"
                    checked={inviteForm.permissions.can_broadcast}
                    onChange={(checked) => setInviteForm({
                      ...inviteForm,
                      permissions: { ...inviteForm.permissions, can_broadcast: checked }
                    })}
                  />
                  <PermissionCheckbox
                    label="ตั้งค่า Channel"
                    description="สามารถเข้าถึงหน้าจัดการและตั้งค่า LINE Channel ได้"
                    checked={inviteForm.permissions.can_manage_channel}
                    onChange={(checked) => setInviteForm({
                      ...inviteForm,
                      permissions: { ...inviteForm.permissions, can_manage_channel: checked }
                    })}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false);
                    resetInviteForm();
                  }}
                  className="btn btn-secondary flex-1"
                >
                  {inviteLink ? 'ปิด' : 'ยกเลิก'}
                </button>
                {!inviteLink && (
                  <button
                    type="submit"
                    disabled={inviting}
                    className="btn btn-primary flex-1"
                  >
                    {inviting ? (
                      <span className="flex items-center gap-2">
                        <div className="spinner w-4 h-4 border-white border-t-transparent" />
                        กำลังสร้าง...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <FiLink className="w-4 h-4" />
                        สร้างลิงก์เชิญ
                      </span>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FiShield className="w-5 h-5 text-blue-500" />
                แก้ไขสิทธิ์
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {editingMember.admin_name || editingMember.admin_email}
              </p>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Channel
                </label>
                <select
                  value={editForm.channel_id}
                  onChange={(e) => setEditForm({ ...editForm, channel_id: e.target.value })}
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
                  <PermissionCheckbox
                    label="ตอบแชท"
                    description="สามารถตอบข้อความลูกค้าได้"
                    checked={editForm.permissions.can_reply}
                    onChange={(checked) => setEditForm({
                      ...editForm,
                      permissions: { ...editForm.permissions, can_reply: checked }
                    })}
                  />
                  <PermissionCheckbox
                    label="ดูแชททั้งหมด"
                    description="สามารถดูแชททุกการสนทนาได้"
                    checked={editForm.permissions.can_view_all}
                    onChange={(checked) => setEditForm({
                      ...editForm,
                      permissions: { ...editForm.permissions, can_view_all: checked }
                    })}
                  />
                  <PermissionCheckbox
                    label="ส่ง Broadcast"
                    description="สามารถส่งข้อความไปยังลูกค้าทั้งหมดได้"
                    checked={editForm.permissions.can_broadcast}
                    onChange={(checked) => setEditForm({
                      ...editForm,
                      permissions: { ...editForm.permissions, can_broadcast: checked }
                    })}
                  />
                  <PermissionCheckbox
                    label="ตั้งค่า Channel"
                    description="สามารถเข้าถึงหน้าจัดการและตั้งค่า LINE Channel ได้"
                    checked={editForm.permissions.can_manage_channel}
                    onChange={(checked) => setEditForm({
                      ...editForm,
                      permissions: { ...editForm.permissions, can_manage_channel: checked }
                    })}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingMember(null);
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
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <div className="spinner w-4 h-4 border-white border-t-transparent" />
                      กำลังบันทึก...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <FiCheck className="w-4 h-4" />
                      บันทึก
                    </span>
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

// Permission Checkbox Component
function PermissionCheckbox({ 
  label, 
  description, 
  checked, 
  onChange 
}: { 
  label: string; 
  description: string; 
  checked: boolean; 
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
      />
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
    </label>
  );
}