'use client';

import { useEffect, useState } from 'react';
import { 
  FiSettings, FiBell, FiMail, FiLock, FiGlobe,
  FiSave, FiCheck, FiAlertCircle, FiCopy, FiRefreshCw, FiTrash2, FiLink
} from 'react-icons/fi';
import Swal from 'sweetalert2';

interface Settings {
  notifications: {
    email_new_message: boolean;
    email_daily_report: boolean;
    browser_notifications: boolean;
    sound_enabled: boolean;
  };
  chat: {
    auto_assign: boolean;
    auto_reply_enabled: boolean;
    working_hours_only: boolean;
    working_hours_start: string;
    working_hours_end: string;
  };
  general: {
    timezone: string;
    language: string;
    date_format: string;
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    notifications: {
      email_new_message: true,
      email_daily_report: false,
      browser_notifications: true,
      sound_enabled: true
    },
    chat: {
      auto_assign: false,
      auto_reply_enabled: true,
      working_hours_only: false,
      working_hours_start: '09:00',
      working_hours_end: '18:00'
    },
    general: {
      timezone: 'Asia/Bangkok',
      language: 'th',
      date_format: 'DD/MM/YYYY'
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('notifications');
  
  // Bot Integration state
  const [botToken, setBotToken] = useState<string | null>(null);
  const [loadingBotToken, setLoadingBotToken] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchBotToken();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.data) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBotToken = async () => {
    setLoadingBotToken(true);
    try {
      const res = await fetch('/api/settings/bot-token');
      const data = await res.json();
      if (data.success) {
        setBotToken(data.data.bot_api_token);
      }
    } catch (error) {
      console.error('Error fetching bot token:', error);
    } finally {
      setLoadingBotToken(false);
    }
  };

  const generateBotToken = async () => {
    const result = await Swal.fire({
      title: 'สร้าง Bot API Token ใหม่?',
      text: botToken ? 'Token เดิมจะถูกยกเลิกและใช้งานไม่ได้' : 'ระบบจะสร้าง Token สำหรับเชื่อมต่อ Bot Server',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#06C755',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'สร้าง Token',
      cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    setGeneratingToken(true);
    try {
      const res = await fetch('/api/settings/bot-token', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBotToken(data.data.bot_api_token);
        Swal.fire({
          icon: 'success',
          title: 'สร้าง Token สำเร็จ',
          text: 'คัดลอก URL ไปใส่ใน Bot Server ของคุณ',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error.message
      });
    } finally {
      setGeneratingToken(false);
    }
  };

  const revokeBotToken = async () => {
    const result = await Swal.fire({
      title: 'ยกเลิก Bot API Token?',
      text: 'Bot Server จะไม่สามารถส่งข้อมูลมา BevChat ได้อีก',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'ยกเลิก Token',
      cancelButtonText: 'ไม่ใช่'
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch('/api/settings/bot-token', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setBotToken(null);
        Swal.fire({
          icon: 'success',
          title: 'ยกเลิก Token สำเร็จ',
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error.message
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({
      icon: 'success',
      title: 'คัดลอกแล้ว',
      timer: 1000,
      showConfirmButton: false,
      position: 'top-end',
      toast: true
    });
  };

  const getBotApiUrl = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/api/bot-messages/log/${botToken}`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ',
          text: 'การตั้งค่าถูกบันทึกเรียบร้อยแล้ว',
          timer: 2000,
          showConfirmButton: false
        });
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

  const tabs = [
    { id: 'notifications', label: 'การแจ้งเตือน', icon: FiBell },
    { id: 'chat', label: 'แชท', icon: FiMail },
    { id: 'bot', label: 'Bot Integration', icon: FiLink },
    { id: 'general', label: 'ทั่วไป', icon: FiGlobe }
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="spinner w-8 h-8 mx-auto mb-4" />
            <p className="text-gray-500">กำลังโหลด...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FiSettings className="text-line-green" />
            ตั้งค่า
          </h1>
          <p className="text-gray-500 mt-1">จัดการการตั้งค่าระบบ</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary gap-2"
        >
          {saving ? (
            <>
              <div className="spinner w-4 h-4" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <FiSave className="w-5 h-5" />
              บันทึก
            </>
          )}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-line-green/10 text-line-green border-l-4 border-line-green' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {/* Notifications */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FiBell className="text-line-green" />
                  การแจ้งเตือน
                </h2>

                <div className="space-y-4">
                  <ToggleSetting
                    label="แจ้งเตือนทางอีเมลเมื่อมีข้อความใหม่"
                    description="รับอีเมลเมื่อมีข้อความจากลูกค้า"
                    checked={settings.notifications.email_new_message}
                    onChange={(checked) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, email_new_message: checked }
                    })}
                  />

                  <ToggleSetting
                    label="รายงานสรุปประจำวัน"
                    description="รับอีเมลสรุปการสนทนาประจำวัน"
                    checked={settings.notifications.email_daily_report}
                    onChange={(checked) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, email_daily_report: checked }
                    })}
                  />

                  <ToggleSetting
                    label="การแจ้งเตือนบน Browser"
                    description="แสดงการแจ้งเตือนบน Browser เมื่อมีข้อความใหม่"
                    checked={settings.notifications.browser_notifications}
                    onChange={(checked) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, browser_notifications: checked }
                    })}
                  />

                  <ToggleSetting
                    label="เสียงแจ้งเตือน"
                    description="เปิดเสียงเมื่อมีข้อความใหม่"
                    checked={settings.notifications.sound_enabled}
                    onChange={(checked) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, sound_enabled: checked }
                    })}
                  />
                </div>
              </div>
            )}

            {/* Chat */}
            {activeTab === 'chat' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FiMail className="text-line-green" />
                  การตั้งค่าแชท
                </h2>

                <div className="space-y-4">
                  <ToggleSetting
                    label="มอบหมายอัตโนมัติ"
                    description="มอบหมายการสนทนาใหม่ให้ทีมงานโดยอัตโนมัติ"
                    checked={settings.chat.auto_assign}
                    onChange={(checked) => setSettings({
                      ...settings,
                      chat: { ...settings.chat, auto_assign: checked }
                    })}
                  />

                  <ToggleSetting
                    label="เปิดใช้งาน Auto Reply"
                    description="ตอบกลับข้อความอัตโนมัติตาม keyword"
                    checked={settings.chat.auto_reply_enabled}
                    onChange={(checked) => setSettings({
                      ...settings,
                      chat: { ...settings.chat, auto_reply_enabled: checked }
                    })}
                  />

                  <ToggleSetting
                    label="จำกัดเวลาทำการ"
                    description="Auto Reply ทำงานเฉพาะในเวลาทำการ"
                    checked={settings.chat.working_hours_only}
                    onChange={(checked) => setSettings({
                      ...settings,
                      chat: { ...settings.chat, working_hours_only: checked }
                    })}
                  />

                  {settings.chat.working_hours_only && (
                    <div className="ml-6 p-4 bg-gray-50 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        เวลาทำการ
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="time"
                          value={settings.chat.working_hours_start}
                          onChange={(e) => setSettings({
                            ...settings,
                            chat: { ...settings.chat, working_hours_start: e.target.value }
                          })}
                          className="input"
                        />
                        <span className="text-gray-500">ถึง</span>
                        <input
                          type="time"
                          value={settings.chat.working_hours_end}
                          onChange={(e) => setSettings({
                            ...settings,
                            chat: { ...settings.chat, working_hours_end: e.target.value }
                          })}
                          className="input"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bot Integration */}
            {activeTab === 'bot' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FiLink className="text-line-green" />
                  Bot Integration
                </h2>
                <p className="text-gray-500 text-sm">
                  เชื่อมต่อ Bot Server ภายนอกเพื่อให้ข้อความที่ Bot ส่งแสดงใน BevChat
                </p>

                {loadingBotToken ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="spinner w-6 h-6" />
                  </div>
                ) : botToken ? (
                  <div className="space-y-4">
                    {/* Bot API URL */}
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <label className="block text-sm font-medium text-green-800 mb-2">
                        🔗 Bot API URL (นำไปใส่ฝั่ง Bot Server)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={getBotApiUrl()}
                          className="input flex-1 bg-white font-mono text-sm"
                        />
                        <button
                          onClick={() => copyToClipboard(getBotApiUrl())}
                          className="btn btn-primary px-3"
                          title="คัดลอก URL"
                        >
                          <FiCopy className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-xs text-green-600 mt-2">
                        * หากคุณใช้ Bot Server จากที่อื่น ให้นำ URL นี้ไปตั้งค่าในระบบของคุณ
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-4 border-t">
                      <button
                        onClick={generateBotToken}
                        disabled={generatingToken}
                        className="btn bg-orange-500 text-white hover:bg-orange-600 gap-2"
                      >
                        {generatingToken ? (
                          <div className="spinner w-4 h-4" />
                        ) : (
                          <FiRefreshCw className="w-4 h-4" />
                        )}
                        สร้าง Token ใหม่
                      </button>
                      <button
                        onClick={revokeBotToken}
                        className="btn bg-red-500 text-white hover:bg-red-600 gap-2"
                      >
                        <FiTrash2 className="w-4 h-4" />
                        ยกเลิก Token
                      </button>
                    </div>

                    {/* Instructions */}
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-medium text-blue-800 mb-2">📖 วิธีใช้งาน</h3>
                      <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                        <li>คัดลอก URL ด้านบน</li>
                        <li>นำไปตั้งค่าใน Bot Server ของคุณ</li>
                        <li>Restart Bot Server</li>
                        <li>ข้อความที่ Bot ส่งจะแสดงใน Inbox อัตโนมัติ</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FiLink className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      ยังไม่มี Bot API Token
                    </h3>
                    <p className="text-gray-500 mb-4">
                      สร้าง Token เพื่อเชื่อมต่อ Bot Server กับ BevChat
                    </p>
                    <button
                      onClick={generateBotToken}
                      disabled={generatingToken}
                      className="btn btn-primary gap-2"
                    >
                      {generatingToken ? (
                        <>
                          <div className="spinner w-4 h-4" />
                          กำลังสร้าง...
                        </>
                      ) : (
                        <>
                          <FiLink className="w-5 h-5" />
                          สร้าง Bot API Token
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* General */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FiGlobe className="text-line-green" />
                  ตั้งค่าทั่วไป
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      เขตเวลา
                    </label>
                    <select
                      value={settings.general.timezone}
                      onChange={(e) => setSettings({
                        ...settings,
                        general: { ...settings.general, timezone: e.target.value }
                      })}
                      className="input w-full max-w-md"
                    >
                      <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
                      <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                      <option value="UTC">UTC (GMT+0)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ภาษา
                    </label>
                    <select
                      value={settings.general.language}
                      onChange={(e) => setSettings({
                        ...settings,
                        general: { ...settings.general, language: e.target.value }
                      })}
                      className="input w-full max-w-md"
                    >
                      <option value="th">ไทย</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      รูปแบบวันที่
                    </label>
                    <select
                      value={settings.general.date_format}
                      onChange={(e) => setSettings({
                        ...settings,
                        general: { ...settings.general, date_format: e.target.value }
                      })}
                      className="input w-full max-w-md"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Toggle Setting Component
function ToggleSetting({ 
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
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-line-green' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}