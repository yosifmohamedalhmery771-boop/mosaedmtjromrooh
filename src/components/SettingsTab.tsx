import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Save, Plus, Trash2, Folder, Link, Phone, FileText, Sparkles, Check, Server, Eye, EyeOff, Code, Clipboard, Lock, Unlock, KeyRound } from 'lucide-react';
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

    if (action === "get_base64") {
      const fileId = e.parameter.fileId;
      if (!fileId) return handleResponse({ success: false, error: "Missing fileId" }, 400);
      
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      const base64 = Utilities.base64Encode(blob.getBytes());
      return handleResponse({
        success: true,
        base64: base64,
        mimeType: blob.getContentType(),
        fileName: file.getName()
      });
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
    
    if (action === "get_base64") {
      const fileId = postData.fileId;
      if (!fileId) return handleResponse({ success: false, error: "Missing fileId" }, 400);
      
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      const base64 = Utilities.base64Encode(blob.getBytes());
      return handleResponse({
        success: true,
        base64: base64,
        mimeType: blob.getContentType(),
        fileName: file.getName()
      });
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
  
  // 5 Closing Messages state
  const [closingMessages, setClosingMessages] = useState<string[]>(
    settings.closingMessages || [DEFAULT_POEM, '', '', '', '']
  );
  const [activeMsgConfigTab, setActiveMsgConfigTab] = useState(0);

  const [appsScriptUrl, setAppsScriptUrl] = useState(settings.appsScriptUrl || '');
  const [apiKey, setApiKey] = useState(settings.apiKey || 'um_rouh_secret_key');
  const [adminPin, setAdminPin] = useState(settings.adminPin || '1234');
  const [newAdminPin, setNewAdminPin] = useState(settings.adminPin || '1234');

  // Lock status and PIN inputs
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'connection'>('general');
  const [enteredPin, setEnteredPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinError, setPinError] = useState('');

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
    setClosingMessages(settings.closingMessages || [DEFAULT_POEM, '', '', '', '']);
    setAppsScriptUrl(settings.appsScriptUrl || '');
    setApiKey(settings.apiKey || 'um_rouh_secret_key');
    setAdminPin(settings.adminPin || '1234');
    setNewAdminPin(settings.adminPin || '1234');
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
      ...settings,
      folders: updatedFolders,
      whatsappChannelUrl,
      whatsappOrderUrl,
      closingPoem,
      closingMessages,
      appsScriptUrl,
      apiKey,
      adminPin
    };
    onSave(updatedSettings);
  };

  const handleRemoveFolder = (id: string) => {
    const isConfirmed = window.confirm('هل أنت متأكد من رغبتك في إزالة هذا المجلد من الإعدادات؟ لن يتم حذف المجلد الفعلي من Google Drive.');
    if (!isConfirmed) return;

    const updatedFolders = folders.filter(f => f.id !== id);
    setFolders(updatedFolders);
    
    const updatedSettings = {
      ...settings,
      folders: updatedFolders,
      whatsappChannelUrl,
      whatsappOrderUrl,
      closingPoem,
      closingMessages,
      appsScriptUrl,
      apiKey,
      adminPin
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

  const handleUnlockConnectionTab = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (enteredPin.trim() === adminPin.trim()) {
      setIsUnlocked(true);
      setPinError('');
    } else {
      setPinError('رمز الدخول غير صحيح! يرجى المحاولة مرة أخرى.');
    }
  };

  const handleSaveAllSettings = () => {
    if (!newAdminPin.trim()) {
      alert('رمز الدخول (PIN) لا يمكن أن يكون فارغاً!');
      return;
    }

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
      closingMessages: closingMessages.map(m => m.trim()),
      appsScriptUrl: appsScriptUrl.trim(),
      apiKey: apiKey.trim(),
      adminPin: newAdminPin.trim()
    };
    onSave(updatedSettings);
    setAdminPin(newAdminPin.trim());
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

      {/* Settings Sub-Tabs Switcher */}
      <div className="flex bg-white border border-gray-150 p-1 rounded-2xl w-full sm:max-w-md mx-auto relative shadow-sm shrink-0">
        <button
          type="button"
          onClick={() => setActiveSubTab('general')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'general'
              ? 'bg-[#F27D26] text-white shadow-md'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>الإعدادات العامة والرسائل</span>
        </button>
        
        <button
          type="button"
          onClick={() => {
            setActiveSubTab('connection');
            // Reset entered PIN when switching tabs if not already unlocked
            if (!isUnlocked) {
              setEnteredPin('');
              setPinError('');
            }
          }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'connection'
              ? 'bg-[#F27D26] text-white shadow-md'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>ربط جوجل درايف 🔐</span>
        </button>
      </div>

      {activeSubTab === 'general' ? (
        /* Sub-Tab 1: General Settings & Messages - Centered card to prevent left empty space */
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
              <div className="p-2.5 bg-orange-50 text-[#F27D26] rounded-xl border border-orange-100">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">إعدادات النشر والربط التسويقي</h2>
                <p className="text-xs text-gray-500 font-medium">تخصيص قنوات الواتساب والرسائل الختامية للأصناف</p>
              </div>
            </div>

            <div className="space-y-5">
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
                  className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none transition font-mono"
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
                  className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-2.5 text-xs text-gray-900 outline-none transition font-mono"
                  dir="ltr"
                />
                <p className="text-[10px] text-gray-400 mt-1">إذا أدخلت الرقم فقط، سيقوم التطبيق تلقائياً بتحويله إلى رابط واتساب مباشر سريع.</p>
              </div>

              {/* 5 Closing Messages Configuration */}
              <div className="space-y-4 pt-2 border-t border-gray-50">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-1">
                  <FileText className="w-4.5 h-4.5 text-[#F27D26]" />
                  <span>الرسائل الختامية المتنوعة للأصناف ({closingMessages.length})</span>
                </label>
                <p className="text-[11px] text-gray-500 mt-[-4px]">انقر على كل تبويب لتخصيص محتوى الرسائل الـ 5 التي يختار منها الموظف عند النشر:</p>
                
                {/* Tab buttons for the 5 messages */}
                <div className="flex flex-wrap gap-1 bg-gray-50 p-1 rounded-xl border border-gray-150">
                  {[
                    "القصيدة والترحيب",
                    "خصم وعرض خاص",
                    "طريقة الطلب",
                    "متابعة القناة",
                    "جودة وضمان"
                  ].map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveMsgConfigTab(idx)}
                      className={`flex-1 min-w-[70px] text-center py-2 px-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                        activeMsgConfigTab === idx
                          ? "bg-[#F27D26] text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Active Message text area */}
                <div className="relative">
                  <textarea
                    value={closingMessages[activeMsgConfigTab] || ''}
                    onChange={e => {
                      const updated = [...closingMessages];
                      updated[activeMsgConfigTab] = e.target.value;
                      setClosingMessages(updated);
                      
                      if (activeMsgConfigTab === 0) {
                        setClosingPoem(e.target.value);
                      }
                    }}
                    rows={6}
                    placeholder="اكتب محتوى الرسالة الختامية لهذا الخيار..."
                    className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl p-4 text-xs text-gray-955 outline-none transition leading-relaxed resize-none font-sans"
                  />
                  <div className="absolute bottom-3 left-3 bg-orange-50 text-[#F27D26] text-[8px] px-2 py-0.5 rounded-md font-bold">
                    تعديل مؤقت
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white border border-gray-150 rounded-3xl p-4 shadow-xl flex items-center justify-between gap-4 sticky bottom-4 z-40">
            <p className="text-xs text-gray-500 font-medium hidden md:block">يرجى التأكد من الضغط على زر الحفظ لتخزين جميع إعدادات القنوات والرسائل بنجاح.</p>
            <button
              type="button"
              onClick={handleSaveAllSettings}
              className="w-full md:w-auto bg-[#F27D26] hover:bg-[#d96a1a] text-white font-bold text-sm py-3.5 px-8 rounded-2xl flex items-center justify-center gap-2 transition shadow-lg shadow-orange-100 cursor-pointer"
            >
              <Save className="w-5 h-5" />
              <span>حفظ إعدادات القنوات والرسائل</span>
            </button>
          </div>
        </div>
      ) : (
        /* Sub-Tab 2: Google Drive Connection Settings - "التبويب الخاص" */
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
          {!isUnlocked ? (
            /* PIN Passcode Lock Screen for the connection tab - NO Google Sign-In */
            <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-xl max-w-md mx-auto text-center space-y-6 mt-6">
              <div className="mx-auto w-16 h-16 bg-orange-50 text-[#F27D26] border border-orange-100 rounded-2xl flex items-center justify-center">
                <KeyRound className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">دخول التبويب الخاص بالربط</h2>
                <p className="text-xs text-gray-500 leading-relaxed px-4">
                  هذا التبويب محمي برمز مرور آمن لتفادي تعديل روابط وصلاحيات الوصول السحابي بالخطأ.
                </p>
              </div>

              <form onSubmit={handleUnlockConnectionTab} className="space-y-4">
                <div>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={enteredPin}
                    onChange={e => setEnteredPin(e.target.value)}
                    placeholder="أدخل رمز الدخول (PIN)..."
                    className="w-full bg-gray-50 border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-3 text-center text-lg font-black tracking-widest text-gray-900 outline-none transition"
                    autoFocus
                  />
                  {pinError && (
                    <p className="text-xs text-red-500 font-bold mt-2 flex items-center justify-center gap-1">
                      <span>⚠️</span>
                      <span>{pinError}</span>
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#F27D26] hover:bg-[#d96a1a] text-white font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-orange-100 cursor-pointer"
                >
                  <Unlock className="w-4 h-4" />
                  <span>تأكيد وإلغاء القفل</span>
                </button>
              </form>

              <div className="pt-4 border-t border-gray-50 text-[10px] text-gray-400">
                <span>تلميح: الرمز الافتراضي هو </span>
                <strong className="text-gray-600 font-mono">1234</strong>
                <span> ويمكنك تعديله متى شئت.</span>
              </div>
            </div>
          ) : (
            /* Unlocked Private Connection Tab Content */
            <div className="space-y-6">
              {/* Unlock Success & Re-lock Header Banner */}
              <div className="bg-green-50/70 border border-green-100 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-ping shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-green-900 leading-snug">بوابة الربط السحابي مفتوحة</p>
                    <p className="text-xs text-green-700/80 mt-0.5">يمكنك الآن تعديل رابط تطبيق الويب للـ Apps Script وإدارة المجلدات المتاحة.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsUnlocked(false);
                    setEnteredPin('');
                  }}
                  className="text-xs font-bold text-gray-600 hover:text-red-600 bg-white border border-gray-200 px-4 py-2 rounded-xl transition shadow-sm hover:shadow shrink-0 cursor-pointer"
                >
                  قفل التبويب فوراً 🔒
                </button>
              </div>

              {/* Grid content inside max-width container to prevent left blank space */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Apps Script Settings */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-5">
                  <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
                    <div className="p-2.5 bg-orange-50 text-[#F27D26] rounded-xl border border-orange-100">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">الربط السحابي (Apps Script)</h2>
                      <p className="text-[11px] text-gray-400 font-medium">بوابة معالجة وتدفق صور جوجل درايف بأمان</p>
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
                        className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-2.5 text-xs text-gray-955 outline-none transition font-mono"
                        dir="ltr"
                      />
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
                          className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-955 outline-none transition font-mono"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute inset-y-0 left-3 flex items-center text-gray-400 hover:text-gray-600 transition cursor-pointer"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PIN Code settings */}
                <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 border-b border-gray-50 pb-3 mb-4">
                      <div className="p-2.5 bg-orange-50 text-[#F27D26] rounded-xl border border-orange-100">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-gray-900">رمز حماية الإعدادات (PIN)</h2>
                        <p className="text-[11px] text-gray-400 font-medium">قم بتعديل رمز الأمان السري لهذه الصفحة</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">رمز الدخول الجديد (PIN)</label>
                      <input
                        type="text"
                        value={newAdminPin}
                        onChange={e => setNewAdminPin(e.target.value)}
                        placeholder="أدخل رمز الحماية الجديد..."
                        className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-2.5 text-sm font-bold text-center tracking-widest text-gray-955 outline-none transition font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">يرجى كتابة رمز سهل التذكر مثل الرمز الافتراضي (1234) ليتمكن فريق عمل متجر أم روح المصرح لهم من الدخول وإضافة المجلدات.</p>
                </div>
              </div>

              {/* Folders block */}
              <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
                  <div className="p-2.5 bg-orange-50 text-[#F27D26] rounded-xl border border-orange-100">
                    <Folder className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">مجلدات Google Drive المشتركة</h2>
                    <p className="text-[11px] text-gray-400 font-medium font-sans">ربط المجلدات التي تحتوي على صور المنتجات</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Add Folder Form */}
                  <div className="space-y-3 bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1 font-bold">اسم المجلد (مثال: فساتين، عبايات)</label>
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        placeholder="اسم المجلد..."
                        className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-3 py-2 text-xs text-gray-955 outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1 font-bold">رابط المجلد أو معرفه (Folder URL / ID)</label>
                      <input
                        type="text"
                        value={newFolderUrl}
                        onChange={e => setNewFolderUrl(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/..."
                        className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-3 py-2 text-xs text-gray-955 outline-none transition font-mono text-[11px]"
                        dir="ltr"
                      />
                    </div>

                    {folderError && (
                      <p className="text-[11px] text-red-500 font-bold">{folderError}</p>
                    )}

                    <button
                      type="button"
                      onClick={handleAddFolder}
                      className="w-full bg-[#F27D26] hover:bg-[#d96a1a] text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1 transition shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة المجلد</span>
                    </button>
                  </div>

                  {/* List Folders */}
                  <div className="flex flex-col justify-start">
                    <label className="block text-[11px] text-gray-500 mb-1 font-bold">المجلدات الحالية المضافة ({folders.length})</label>
                    {folders.length === 0 ? (
                      <div className="flex-1 border border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center text-gray-400">
                        <Folder className="w-8 h-8 opacity-40 mb-1 text-orange-200" />
                        <span className="text-[10px]">لا توجد مجلدات مضافة بعد. استخدم النموذج لإضافة أول مجلد.</span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar p-1 border border-gray-150 rounded-2xl bg-gray-50/30">
                        {folders.map((folder) => (
                          <div
                            key={folder.id}
                            className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:bg-gray-50 transition"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Folder className="w-4 h-4 text-[#F27D26] shrink-0" />
                              <div className="overflow-hidden">
                                <h4 className="text-xs font-bold text-gray-900 truncate">{folder.name}</h4>
                                <p className="text-[9px] text-gray-400 font-mono truncate" dir="ltr">{folder.id}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFolder(folder.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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

              {/* Action Bar */}
              <div className="bg-white border border-gray-150 rounded-3xl p-4 shadow-xl flex items-center justify-between gap-4 sticky bottom-4 z-40">
                <p className="text-xs text-gray-500 font-medium hidden md:block">يرجى التأكد من الضغط على زر الحفظ لتخزين جميع إعدادات الاتصال السحابي والمجلدات بأمان.</p>
                <button
                  type="button"
                  onClick={handleSaveAllSettings}
                  className="w-full md:w-auto bg-[#F27D26] hover:bg-[#d96a1a] text-white font-bold text-sm py-3.5 px-8 rounded-2xl flex items-center justify-center gap-2 transition shadow-lg shadow-orange-100 cursor-pointer"
                >
                  <Save className="w-5 h-5" />
                  <span>حفظ إعدادات الربط والتحقق</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
