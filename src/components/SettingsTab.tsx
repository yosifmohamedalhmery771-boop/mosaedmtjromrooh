import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Save, Plus, Trash2, Folder, Link, Phone, FileText, Sparkles, Check, Server, Eye, EyeOff, Code, Clipboard } from 'lucide-react';
import { Settings, DriveFolder } from '../types';
import { extractFolderId } from '../lib/drive';

// Default values for initial settings
const DEFAULT_POEM = `بين أرجاء الجمال وحسن الصنع ننفردُ،
وفي متجر أم روح نبع السعدِ يحتشدُ.
طابت لياليكم بمنتجاتنا ترفاً،
شرفٌ لنا خدمتكم، ولكم ودنا الأبدي يتّقدُ ✨`;

const APPS_SCRIPT_CODE_TEMPLATE = `/**
 * كود Google Apps Script كبوابة وسيطة لـ Google Drive لمتجر أم روح
 * يرجى نشره كتطبيق ويب (Web App) وتعيين صلاحية الوصول لـ (Anyone)
 */

const API_KEY = "um_rouh_secret_key"; // يمكنك تعديل هذا المفتاح للأمان ليتطابق مع إعدادات تطبيقك

function doGet(e) {
  try {
    const action = e.parameter.action;
    const apiKey = e.parameter.apiKey;
    
    // التحقق من مفتاح الأمان
    if (apiKey !== API_KEY) {
      return handleResponse({ success: false, error: "Unauthorized: Invalid API Key" }, 401);
    }
    
    if (action === "list") {
      const folderId = e.parameter.folderId;
      if (!folderId) return handleResponse({ success: false, error: "Missing folderId" }, 400);
      
      const folder = DriveApp.getFolderById(folderId);
      const files = folder.getFiles();
      const list = [];
      
      while (files.hasNext()) {
        const file = files.next();
        const mime = file.getMimeType();
        if (mime.indexOf("image/") !== -1) {
          list.push({
            id: file.getId(),
            name: file.getName(),
            mimeType: mime
          });
        }
      }
      return handleResponse({ success: true, files: list });
    }
    
    return handleResponse({ status: "running", message: "Google Apps Script API Gateway for Um Rouh Store is active" });
  } catch (err) {
    return handleResponse({ success: false, error: err.toString() }, 500);
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    
    // التحقق من مفتاح الأمان
    if (postData.apiKey !== API_KEY) {
      return handleResponse({ success: false, error: "Unauthorized: Invalid API Key" }, 401);
    }
    
    const action = postData.action;
    
    if (action === "list") {
      const folderId = postData.folderId;
      if (!folderId) return handleResponse({ success: false, error: "Missing folderId" }, 400);
      
      const folder = DriveApp.getFolderById(folderId);
      const files = folder.getFiles();
      const list = [];
      
      while (files.hasNext()) {
        const file = files.next();
        const mime = file.getMimeType();
        if (mime.indexOf("image/") !== -1) {
          list.push({
            id: file.getId(),
            name: file.getName(),
            mimeType: mime
          });
        }
      }
      return handleResponse({ success: true, files: list });
    }
    
    if (action === "upload") {
      const folderId = postData.folderId;
      const fileBase64 = postData.fileBase64; // base64 encoding
      const fileName = postData.fileName;
      const mimeType = postData.mimeType || "image/jpeg";
      
      if (!folderId || !fileBase64 || !fileName) {
        return handleResponse({ success: false, error: "Missing parameters for upload" }, 400);
      }
      
      const folder = DriveApp.getFolderById(folderId);
      
      // التعامل مع داتا URL إذا كانت موجودة
      let base64Data = fileBase64;
      if (base64Data.indexOf(",") !== -1) {
        base64Data = base64Data.split(",")[1];
      }
      
      const decodedBytes = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
      const file = folder.createFile(blob);
      
      // تعيين صلاحية القراءة للجميع ليتم عرض الصورة في المتجر
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      return handleResponse({ 
        success: true, 
        file: {
          id: file.getId(), 
          name: file.getName(),
          mimeType: file.getMimeType()
        }
      });
    }
    
    if (action === "rename") {
      const fileId = postData.fileId;
      const newName = postData.newName;
      if (!fileId || !newName) return handleResponse({ success: false, error: "Missing parameters" }, 400);
      
      const file = DriveApp.getFileById(fileId);
      file.setName(newName);
      return handleResponse({ success: true, fileId: fileId, newName: newName });
    }
    
    if (action === "delete") {
      const fileId = postData.fileId;
      if (!fileId) return handleResponse({ success: false, error: "Missing fileId" }, 400);
      
      const file = DriveApp.getFileById(fileId);
      file.setTrashed(true);
      return handleResponse({ success: true, message: "File trashed" });
    }
    
    return handleResponse({ success: false, error: "Unknown action: " + action }, 400);
    
  } catch (err) {
    return handleResponse({ success: false, error: err.toString() }, 500);
  }
}

function handleResponse(data, code) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}`;

interface SettingsTabProps {
  settings: Settings;
  onSave: (newSettings: Settings) => void;
}

export default function SettingsTab({ settings, onSave }: SettingsTabProps) {
  const [folders, setFolders] = useState<DriveFolder[]>(settings.folders || []);
  const [whatsappChannelUrl, setWhatsappChannelUrl] = useState(settings.whatsappChannelUrl || '');
  const [whatsappOrderUrl, setWhatsappOrderUrl] = useState(settings.whatsappOrderUrl || '');
  const [closingPoem, setClosingPoem] = useState(settings.closingPoem || DEFAULT_POEM);
  const [appsScriptUrl, setAppsScriptUrl] = useState(settings.appsScriptUrl || '');
  const [apiKey, setApiKey] = useState(settings.apiKey || 'um_rouh_secret_key');

  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

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
    setAppsScriptUrl(settings.appsScriptUrl || '');
    setApiKey(settings.apiKey || 'um_rouh_secret_key');
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
      closingPoem,
      appsScriptUrl,
      apiKey
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
      closingPoem,
      appsScriptUrl,
      apiKey
    };
    onSave(updatedSettings);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE_TEMPLATE);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
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
      closingPoem: closingPoem.trim(),
      appsScriptUrl: appsScriptUrl.trim(),
      apiKey: apiKey.trim()
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
        
        {/* Left Column: Folders Manager & Apps Script Configuration */}
        <div className="space-y-8">
          
          {/* Apps Script Connection Panel */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <div className="p-2.5 bg-orange-50 text-[#F27D26] rounded-xl border border-orange-100">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">ربط السحابة بـ Google Apps Script</h2>
                <p className="text-xs text-gray-500 font-medium">قم بربط درايف عبر بوابة وسيطة خفيفة ومستقلة تماماً</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Web App URL */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">رابط تطبيق الويب للـ Apps Script (Web App URL)</label>
                <input
                  type="url"
                  value={appsScriptUrl}
                  onChange={e => setAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none transition font-mono"
                  dir="ltr"
                />
                <p className="text-[10px] text-gray-400 mt-1">يتم الحصول على هذا الرابط عند نشر سكربت جوجل بنجاح كتطبيق ويب.</p>
              </div>

              {/* Secure API Key */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">مفتاح أمان الاتصال (API Key)</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="um_rouh_secret_key"
                    className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl pl-12 pr-4 py-2.5 text-sm text-gray-900 outline-none transition font-mono"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute inset-y-0 left-3 flex items-center text-gray-400 hover:text-gray-600 transition"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">رمز أمان بسيط للتحقق من هوية التطبيق وحظر الاستخدام غير المصرح به لبوابتك السحابية.</p>
              </div>
            </div>
          </div>

          {/* Folders List Card */}
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

        </div>
        
        {/* Right Column: Communication & Poetic Message */}
        <div className="space-y-8">
          
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

            <div className="pt-2 border-t border-gray-50 flex gap-3">
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

          {/* Copyable Google Apps Script Template */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Code className="w-4 h-4 text-[#F27D26]" />
                <span>كود Google Apps Script الجاهز للمشروع</span>
              </h3>
              <button
                type="button"
                onClick={handleCopyCode}
                className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                  copiedCode
                    ? 'bg-green-50 text-green-600 border-green-100'
                    : 'bg-gray-50 text-gray-600 border-gray-150 hover:bg-gray-100'
                }`}
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'تم النسخ!' : 'نسخ كود السكربت'}</span>
              </button>
            </div>
            
            <p className="text-xs text-gray-500 leading-relaxed">
              انسخ الكود أعلاه، ثم توجه إلى <a href="https://script.google.com" target="_blank" rel="noopener noreferrer" className="text-[#F27D26] hover:underline font-bold">Google Apps Script</a> وألصقه في ملف <code className="font-mono bg-gray-50 px-1 py-0.5 rounded text-[11px]">Code.gs</code>. ثم انقر على **Deploy &gt; New Deployment** واختر **Web App**، ثم اضبط الصلاحية لـ **Anyone**.
            </p>

            <div className="bg-gray-950 rounded-2xl p-4 overflow-x-auto max-h-[160px] custom-scrollbar" dir="ltr">
              <pre className="text-[10px] text-gray-300 font-mono select-all leading-normal">
                {APPS_SCRIPT_CODE_TEMPLATE}
              </pre>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
