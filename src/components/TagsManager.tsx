//PATH: src/components/TagsManager.tsx
'use client';

import { useState, useEffect } from 'react';
import { FiTag, FiPlus, FiEdit2, FiTrash2, FiX, FiCheck } from 'react-icons/fi';
import Swal from 'sweetalert2';

interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

interface TagsManagerProps {
  channelId: string;
  onTagsChange?: () => void;
}

const TAG_COLORS = [
  '#06C755', // LINE Green
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#F97316', // Orange
  '#14B8A6', // Teal
];

export default function TagsManager({ channelId, onTagsChange }: TagsManagerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState({ name: '', color: '#06C755', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (channelId) {
      fetchTags();
    }
  }, [channelId]);

  const fetchTags = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tags?channel_id=${channelId}`);
      const data = await res.json();
      if (data.success) {
        setTags(data.data);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      Swal.fire({ icon: 'error', title: 'กรุณากรอกชื่อ Tag' });
      return;
    }

    setSaving(true);
    try {
      if (editingTag) {
        // Update existing tag
        const res = await fetch(`/api/tags/${editingTag.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (data.success) {
          Swal.fire({ icon: 'success', title: 'อัพเดท Tag สำเร็จ', timer: 1500, showConfirmButton: false });
          fetchTags();
          resetForm();
          onTagsChange?.();
        } else {
          Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: data.message });
        }
      } else {
        // Create new tag
        const res = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, channel_id: channelId }),
        });
        const data = await res.json();
        if (data.success) {
          Swal.fire({ icon: 'success', title: 'สร้าง Tag สำเร็จ', timer: 1500, showConfirmButton: false });
          fetchTags();
          resetForm();
          onTagsChange?.();
        } else {
          Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: data.message });
        }
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: Tag) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ Tag?',
      text: `ต้องการลบ "${tag.name}" หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          Swal.fire({ icon: 'success', title: 'ลบ Tag สำเร็จ', timer: 1500, showConfirmButton: false });
          fetchTags();
          onTagsChange?.();
        } else {
          Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: data.message });
        }
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด' });
      }
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({ name: tag.name, color: tag.color, description: tag.description || '' });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({ name: '', color: '#06C755', description: '' });
    setEditingTag(null);
    setShowAddForm(false);
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="spinner w-6 h-6 border-2 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <FiTag className="w-4 h-4" />
          Tags ของ Channel นี้
        </h4>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
          >
            <FiPlus className="w-3 h-3" />
            เพิ่ม Tag
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-3 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">ชื่อ Tag</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input text-sm py-1.5"
              placeholder="เช่น VIP, รอติดตาม"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">สี</label>
            <div className="flex flex-wrap gap-1">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-6 h-6 rounded-full transition-all ${
                    formData.color === color ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="btn btn-secondary text-xs py-1.5 flex-1"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary text-xs py-1.5 flex-1"
            >
              {saving ? (
                <div className="spinner w-4 h-4 border-white border-t-transparent" />
              ) : editingTag ? (
                <>
                  <FiCheck className="w-3 h-3 mr-1" />
                  บันทึก
                </>
              ) : (
                <>
                  <FiPlus className="w-3 h-3 mr-1" />
                  เพิ่ม
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Tags List */}
      {tags.length === 0 ? (
        <div className="text-xs text-gray-400 text-center py-4">
          ยังไม่มี Tags ใน Channel นี้
        </div>
      ) : (
        <div className="space-y-1">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded hover:bg-gray-100 group"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-sm">{tag.name}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(tag)}
                  className="p-1 text-gray-400 hover:text-blue-500"
                  title="แก้ไข"
                >
                  <FiEdit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(tag)}
                  className="p-1 text-gray-400 hover:text-red-500"
                  title="ลบ"
                >
                  <FiTrash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
