'use client';

import { useEffect, useState } from 'react';
import { 
  FiTag, FiPlus, FiEdit2, FiTrash2, FiSearch,
  FiMessageSquare, FiX
} from 'react-icons/fi';
import Swal from 'sweetalert2';

interface Tag {
  id: number;
  name: string;
  color: string;
  description: string;
  conversations_count: number;
  created_at: string;
}

const colorOptions = [
  { value: '#EF4444', label: 'แดง' },
  { value: '#F97316', label: 'ส้ม' },
  { value: '#EAB308', label: 'เหลือง' },
  { value: '#22C55E', label: 'เขียว' },
  { value: '#06C755', label: 'LINE Green' },
  { value: '#14B8A6', label: 'เขียวมิ้นต์' },
  { value: '#3B82F6', label: 'น้ำเงิน' },
  { value: '#8B5CF6', label: 'ม่วง' },
  { value: '#EC4899', label: 'ชมพู' },
  { value: '#6B7280', label: 'เทา' },
];

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    color: '#06C755',
    description: ''
  });

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags');
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
    setSaving(true);

    try {
      const url = editingTag 
        ? `/api/tags/${editingTag.id}`
        : '/api/tags';
      
      const res = await fetch(url, {
        method: editingTag ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: editingTag ? 'อัปเดตสำเร็จ' : 'เพิ่มสำเร็จ',
          timer: 1500,
          showConfirmButton: false
        });
        setShowModal(false);
        resetForm();
        fetchTags();
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

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setForm({
      name: tag.name,
      color: tag.color,
      description: tag.description || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (tag: Tag) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ',
      html: `
        <p>คุณต้องการลบ Tag "<strong>${tag.name}</strong>" หรือไม่?</p>
        ${tag.conversations_count > 0 
          ? `<p class="text-sm text-orange-500 mt-2">⚠️ Tag นี้ถูกใช้งานอยู่ ${tag.conversations_count} การสนทนา</p>` 
          : ''
        }
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: 'success',
            title: 'ลบสำเร็จ',
            timer: 1500,
            showConfirmButton: false
          });
          fetchTags();
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

  const resetForm = () => {
    setEditingTag(null);
    setForm({
      name: '',
      color: '#06C755',
      description: ''
    });
  };

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(search.toLowerCase()) ||
    tag.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiTag className="text-line-green" />
            Tags
          </h1>
          <p className="text-gray-500 mt-1">จัดหมวดหมู่การสนทนา</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn btn-primary gap-2"
        >
          <FiPlus className="w-5 h-5" />
          เพิ่ม Tag
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหา Tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
      </div>

      {/* Tags Grid */}
      {loading ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-500">กำลังโหลด...</p>
        </div>
      ) : filteredTags.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <FiTag className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">ยังไม่มี Tag</p>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary mt-4"
          >
            <FiPlus className="w-4 h-4 mr-2" />
            เพิ่ม Tag แรก
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTags.map(tag => (
            <div 
              key={tag.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="font-semibold text-gray-900">{tag.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(tag)}
                    className="p-1.5 text-gray-400 hover:text-line-green hover:bg-gray-100 rounded"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tag)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {tag.description && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                  {tag.description}
                </p>
              )}
              
              <div className="flex items-center gap-1 text-sm text-gray-400">
                <FiMessageSquare className="w-4 h-4" />
                <span>{tag.conversations_count} การสนทนา</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md animate-fadeIn">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingTag ? 'แก้ไข Tag' : 'เพิ่ม Tag'}
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
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อ Tag <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input w-full"
                  placeholder="เช่น สอบถามราคา, ร้องเรียน"
                  required
                  maxLength={50}
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  สี
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setForm({ ...form, color: color.value })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        form.color === color.value 
                          ? 'border-gray-900 scale-110' 
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ตัวอย่าง
                </label>
                <div className="flex items-center gap-2">
                  <span 
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-white text-sm font-medium"
                    style={{ backgroundColor: form.color }}
                  >
                    <FiTag className="w-3 h-3" />
                    {form.name || 'ชื่อ Tag'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  คำอธิบาย
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input w-full"
                  rows={3}
                  placeholder="อธิบายการใช้งาน Tag นี้..."
                  maxLength={200}
                />
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
                  {saving ? 'กำลังบันทึก...' : (editingTag ? 'อัปเดต' : 'เพิ่ม')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
