import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Save, Plus, Trash2, Folder, Link, Phone, FileText, Sparkles, Check } from 'lucide-react';
import { Settings, DriveFolder } from '../types';
import { extractFolderId } from '../lib/drive';

// Default values for initial settings
const DEFAULT_POEM = `بين أرجاء الجمال وحسن الصنع ننفردُ،
وفي متجر أم روح نبع السعدِ يحتشدُ.
طابت لياليكم بمنتجاتنا ترفاً،
شرفٌ لنا خدمتكم، ولكم ودنا الأبدي يتّقدُ ✨`;

interface SettingsTabProps {
  settings: Settings;
  onSave: (newSettings: Settings) => void;
}

export default function SettingsTab({ settings, onSave }: SettingsTabProps) {
  const [folders, setFolders] = useState<DriveFolder[]>(settings.folders || []);
  const [whatsappChannelUrl, setWhatsappChannelUrl] = useState(settings.whatsappChannelUrl || '');
  const [whatsappOrderUrl, setWhatsappOrderUrl] = useState(settings.whatsappOrderUrl || '');
  const [closingPoem, setClosingPoem] = useState(settings.closingPoem || DEFAULT_POEM);

  // New folder input state
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderUrl, setNewFolderUrl] = useState('');
  const [folderError, setFolderError] = useState('');
  
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    // Sync state with props
    setFolders(settings.folders || []);
    setWhatsappChannelUrl(settings.whatsappChannelUrl || '');
    setWhatsappOrderUrl(settings.whatsappOrderUrl || '');
    setClosingPoem(settings.closingPoem || DEFAULT_POEM);
  }, [settings]);

  const handleAddFolder = () => {
    setFolderError('');
    if (!newFolderName.trim()) {
      setFolderError('الرجاء إدخال اسم المجلد');
      return;
    }
    if (!newFolderUrl.trim()) {
      setFolderError('الرجاء إدخال رابط أو معرف مجلد Google Drive');
      return;
    }

    const folderId = extractFolderId(newFolderUrl);
    if (!folderId) {
      setFolderError('عذراً، لم نتمكن من استخراج معرف المجلد من الرابط. تأكد من صحة الرابط.');
      return;
    }

    // Check if folder ID already exists
    if (folders.some(f => f.id === folderId)) {
      setFolderError('هذا المجلد مضاف مسبقاً!');
      return;
    }

    const updatedFolders = [...folders, { id: folderId, name: newFolderName.trim(), url: newFolderUrl.trim() }];
    setFolders(updatedFolders);
    setNewFolderName('');
    setNewFolderUrl('');
    
    // Automatically save updated folders to localStorage
    const updatedSettings = {
      folders: updatedFolders,
      whatsappChannelUrl,
      whatsappOrderUrl,
      closingPoem
    };
    onSave(updatedSettings);
  };

  const handleRemoveFolder = (id: string) => {
    const isConfirmed = window.confirm('هل أنت متأكد من رغبتك في إزالة هذا المجلد من الإعدادات؟ لن يتم حذف المجلد الفعلي من Google Drive.');
    if (!isConfirmed) return;

    const updatedFolders = folders.filter(f => f.id !== id);
    setFolders(updatedFolders);
    
    const updatedSettings = {
      folders: updatedFolders,
      whatsappChannelUrl,
      whatsappOrderUrl,
      closingPoem
    };
    onSave(updatedSettings);
  };

  const handleSaveAll = () => {
    // Format Whatsapp Order URL if it's just a number
    let formattedOrderUrl = whatsappOrderUrl.trim();
    if (formattedOrderUrl && /^[0-9+]+$/.test(formattedOrderUrl)) {
      // It's a phone number, convert to wa.me
      const cleanNum = formattedOrderUrl.replace('+', '');
      formattedOrderUrl = `https://wa.me/${cleanNum}`;
    }

    const updatedSettings = {
      folders,
      whatsappChannelUrl: whatsappChannelUrl.trim(),
      whatsappOrderUrl: formattedOrderUrl,
      closingPoem: closingPoem.trim()
    };
    onSave(updatedSettings);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3000);
  };

  return (
    <div className="space-y-8" id="settings-tab-container">
      {/* Toast Notification */}
      {showSavedToast && (
        <div className="fixed bottom-5 left-5 z-50 bg-[#F27D26] text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-orange-400 animate-bounce">
          <Check className="w-5 h-5" />
          <span className="font-bold text-sm">تم حفظ الإعدادات بنجاح! ✨</span>
        </div>
      )}

      {/* Grid: 2 columns on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Folders Manager */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
            <div className="p-2.5 bg-orange-50 text-[#F27D26] rounded-xl border border-orange-100">
              <Folder className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">مجلدات Google Drive المشتركة</h2>
              <p className="text-xs text-gray-500 font-medium">أضف المجلدات التي تحتوي على صور منتجات المتجر</p>
            </div>
          </div>

          {/* Add Folder Form */}
          <div className="space-y-4 bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
            <h3 className="text-sm font-bold text-[#F27D26]">إضافة مجلد جديد</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-bold">اسم المجلد (مثال: فساتين، عبايات، أحذية)</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="أدخل اسماً مميزاً للمجلد..."
                  className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1 font-bold">رابط مجلد Google Drive أو معرفه (ID)</label>
                <input
                  type="text"
                  value={newFolderUrl}
                  onChange={e => setNewFolderUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none transition font-mono"
                  dir="ltr"
                />
              </div>

              {folderError && (
                <p className="text-xs text-red-500 font-bold">{folderError}</p>
              )}

              <button
                type="button"
                onClick={handleAddFolder}
                className="w-full bg-[#F27D26] hover:bg-[#d96a1a] text-white font-bold text-sm py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-orange-100 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة المجلد</span>
              </button>
            </div>
          </div>

          {/* Folders List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-800">المجلدات الحالية ({folders.length})</h3>
            {folders.length === 0 ? (
              <div className="text-center py-8 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm">
                لا توجد مجلدات مضافة حتى الآن. يرجى إضافة مجلدك الأول أعلاه.
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center justify-between p-3 bg-white hover:bg-gray-50/50 rounded-2xl border border-gray-100 shadow-sm transition group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2 bg-orange-50 text-[#F27D26] border border-orange-100/30 rounded-xl transition shrink-0">
                        <Folder className="w-5 h-5" />
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-sm font-bold text-gray-900 truncate">{folder.name}</h4>
                        <p className="text-[10px] text-gray-400 font-mono truncate" dir="ltr">{folder.id}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFolder(folder.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition shrink-0 cursor-pointer"
                      title="إزالة المجلد"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Communication & Poetic Message */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
            <div className="p-2.5 bg-orange-50 text-[#F27D26] rounded-xl border border-orange-100">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">إعدادات النشر والربط التسويقي</h2>
              <p className="text-xs text-gray-500 font-medium">تخصيص قنوات الواتساب واللمسات الجمالية لرسائلك</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* WhatsApp Channel Link */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1.5">
                <Link className="w-4 h-4 text-[#F27D26]" />
                <span>رابط قناة متجر أم روح على الواتساب</span>
              </label>
              <input
                type="url"
                value={whatsappChannelUrl}
                onChange={e => setWhatsappChannelUrl(e.target.value)}
                placeholder="https://whatsapp.com/channel/..."
                className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none transition font-mono"
                dir="ltr"
              />
            </div>

            {/* WhatsApp Ordering Direct Link */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1.5">
                <Phone className="w-4 h-4 text-[#2D5A27]" />
                <span>رابط أو رقم استقبال الطلبات المباشر (الواتساب)</span>
              </label>
              <input
                type="text"
                value={whatsappOrderUrl}
                onChange={e => setWhatsappOrderUrl(e.target.value)}
                placeholder="مثال: +966500000000 أو https://wa.me/966500000000"
                className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none transition font-mono"
                dir="ltr"
              />
              <p className="text-[10px] text-gray-400 mt-1">إذا أدخلت الرقم فقط، سيقوم التطبيق تلقائياً بتحويله إلى رابط واتساب مباشر سريع.</p>
            </div>

            {/* Closing Poetic Message */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1.5">
                <FileText className="w-4 h-4 text-[#F27D26]" />
                <span>الرسالة الختامية والقصيدة التسويقية (متجر أم روح)</span>
              </label>
              <textarea
                value={closingPoem}
                onChange={e => setClosingPoem(e.target.value)}
                rows={4}
                placeholder="صغ قصيدة تسويقية لامتنان العملاء وودّهم..."
                className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl p-4 text-sm text-gray-900 outline-none transition leading-relaxed resize-none"
              />
              <p className="text-[10px] text-gray-400 mt-1">قصيدة راقية يتم إدراجها آلياً في نهاية كل رسالة تشاركها مع عملائك لتضفي رقيّاً وبهاءً.</p>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-50">
            <button
              type="button"
              onClick={handleSaveAll}
              className="w-full bg-[#F27D26] hover:bg-[#d96a1a] text-white font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-orange-100 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>حفظ جميع الإعدادات</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
