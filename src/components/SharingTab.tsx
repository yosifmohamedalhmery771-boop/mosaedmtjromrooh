import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Folder, Send, MessageSquare, Clipboard, Download, Share2, 
  CheckSquare, Square, Loader2, Sparkles, Check, AlertCircle, Info, Search
} from 'lucide-react';
import { Settings, DriveFolder, DriveFile } from '../types';
import { listFolderImages, getThumbnailUrl, fetchDriveFileAsBlob } from '../lib/drive';

// Generates highly-compatible safe ASCII file names to prevent native share systems (on Android/iOS/PWA)
// from dropping files or throwing silent errors due to Arabic/special characters in filenames.
const createSafeFileFromBlob = (blob: Blob, index: number): File => {
  let mimeType = blob.type || 'image/jpeg';
  if (mimeType === 'application/octet-stream') {
    mimeType = 'image/jpeg';
  }
  let ext = 'jpg';
  if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('gif')) ext = 'gif';
  
  const safeName = `product_image_${index + 1}_${Date.now()}.${ext}`;
  return new File([blob], safeName, { type: mimeType });
};

interface SharingTabProps {
  settings: Settings;
  initialSharedText?: string;
}

export default function SharingTab({ settings, initialSharedText = '' }: SharingTabProps) {
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [images, setImages] = useState<DriveFile[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [description, setDescription] = useState(initialSharedText);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [error, setError] = useState('');

  // Derived filtered images
  const filteredImages = images.filter(img => 
    img.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Feedback states
  const [isSharing, setIsSharing] = useState(false);
  const [shareProgress, setShareProgress] = useState('');
  const [shareSuccessMessage, setShareSuccessMessage] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  // Selected closing message index (0 to 4)
  const [selectedClosingMsgIdx, setSelectedClosingMsgIdx] = useState<number>(0);

  const [isInIframe, setIsInIframe] = useState(false);
  const [shareSupported, setShareSupported] = useState(true);

  // Pre-fetch files for selected images to preserve user gesture during navigator.share
  const [loadedFiles, setLoadedFiles] = useState<Record<string, { file: File; isLoading: boolean; error?: string }>>({});

  // Keep a ref of loadedFiles to prevent stale closure bugs in asynchronous preloading routines
  const loadedFilesRef = useRef(loadedFiles);
  useEffect(() => {
    loadedFilesRef.current = loadedFiles;
  }, [loadedFiles]);

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }
    setShareSupported(!!navigator.share);
  }, []);

  // Preload selected images in background
  useEffect(() => {
    if (!settings.appsScriptUrl) return;

    // Remove unselected images from cache
    setLoadedFiles(prev => {
      const next = { ...prev };
      let changed = false;
      for (const id of Object.keys(next)) {
        if (!selectedImageIds.includes(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    // Fetch newly selected images
    selectedImageIds.forEach((id, index) => {
      if (!loadedFilesRef.current[id]) {
        const img = images.find(i => i.id === id);
        if (!img) return;

        // Set to loading
        setLoadedFiles(prev => ({
          ...prev,
          [id]: { file: new File([], ''), isLoading: true }
        }));

        (async () => {
          try {
            const blob = await fetchDriveFileAsBlob(id, settings.appsScriptUrl, settings.apiKey);
            const file = createSafeFileFromBlob(blob, index);
            setLoadedFiles(prev => ({
              ...prev,
              [id]: { file, isLoading: false }
            }));
          } catch (e: any) {
            console.error('Error pre-fetching file:', id, e);
            setLoadedFiles(prev => ({
              ...prev,
              [id]: { file: new File([], ''), isLoading: false, error: e?.message || 'Failed' }
            }));
          }
        })();
      }
    });
  }, [selectedImageIds, images, settings.appsScriptUrl, settings.apiKey]);

  // Calculate loading percentage
  const selectedCount = selectedImageIds.length;
  const loadedCount = selectedImageIds.filter(id => loadedFiles[id] && !loadedFiles[id].isLoading && !loadedFiles[id].error).length;
  const overallPercent = selectedCount > 0 ? Math.round((loadedCount / selectedCount) * 100) : 0;

  // Sync initial shared text if Web Share Target API is triggered
  useEffect(() => {
    if (initialSharedText) {
      setDescription(initialSharedText);
    }
  }, [initialSharedText]);

  // Load images when folder is selected
  useEffect(() => {
    if (!selectedFolder) {
      setImages([]);
      setSelectedImageIds([]);
      return;
    }

    if (!settings.appsScriptUrl) {
      setError('يرجى تهيئة رابط اتصال Google Apps Script في الإعدادات أولاً لعرض صور المجلد.');
      return;
    }

    const fetchImages = async () => {
      setIsLoadingImages(true);
      setError('');
      setSelectedImageIds([]);
      try {
        const driveImages = await listFolderImages(selectedFolder, settings.appsScriptUrl, settings.apiKey);
        setImages(driveImages);
      } catch (err: any) {
        console.error('Error fetching images:', err);
        setError(err?.message || 'فشل جلب الصور من المجلد المحدد. تأكد من إعدادات الـ Web App والـ API Key وصحة معرّف المجلد.');
      } finally {
        setIsLoadingImages(false);
      }
    };

    fetchImages();
  }, [selectedFolder, settings.appsScriptUrl, settings.apiKey]);

  const toggleImageSelection = (id: string) => {
    setSelectedImageIds(prev => 
      prev.includes(id) ? prev.filter(imgId => imgId !== id) : [...prev, id]
    );
  };

  const selectAllImages = () => {
    setSelectedImageIds(images.map(img => img.id));
  };

  const deselectAllImages = () => {
    setSelectedImageIds([]);
  };

  // Compile the beautiful output message structure requested
  const getCompiledMessage = () => {
    const formattedDesc = description.trim();
    const channelBlock = settings.whatsappChannelUrl 
      ? `\n\nنتشرف بمتابعتكم لقناة متجر أم روح على الواتساب: \n${settings.whatsappChannelUrl}` 
      : '';
    
    const orderBlock = settings.whatsappOrderUrl 
      ? `\n\nيسعدنا ويشرفنا استقبال طلباتكم مباشرة عبر الواتساب: \n${settings.whatsappOrderUrl}` 
      : '';
    
    const activeClosingMsg = settings.closingMessages && settings.closingMessages[selectedClosingMsgIdx]
      ? settings.closingMessages[selectedClosingMsgIdx]
      : settings.closingPoem;

    const poemBlock = activeClosingMsg 
      ? `\n\n${activeClosingMsg}` 
      : '';

    return `${formattedDesc}${channelBlock}${orderBlock}${poemBlock}`;
  };

  const handleCopyText = async () => {
    const compiled = getCompiledMessage();
    try {
      await navigator.clipboard.writeText(compiled);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const downloadSelectedImages = async () => {
    const selected = images.filter(img => selectedImageIds.includes(img.id));
    if (selected.length === 0) return;

    let failedCount = 0;
    for (const img of selected) {
      try {
        const cached = loadedFiles[img.id];
        let blob: Blob;
        if (cached && !cached.isLoading && cached.file && cached.file.size > 0) {
          blob = cached.file;
        } else {
          blob = await fetchDriveFileAsBlob(img.id, settings.appsScriptUrl, settings.apiKey);
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = img.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Error downloading image', img.name, err);
        failedCount++;
      }
    }
    
    if (failedCount > 0) {
      console.warn(`${failedCount} images failed to download from Google Drive.`);
    }
  };

  const handleShareToChannel = async () => {
    if (!description.trim()) {
      alert('الرجاء إدخال وصف المنتج أولاً!');
      return;
    }

    if (!settings.whatsappChannelUrl) {
      alert('يرجى إضافة رابط قناة المتجر في الإعدادات أولاً لتتمكن من النشر الفوري بالقناة!');
      return;
    }

    setIsSharing(true);
    setShareSuccessMessage('');
    setShareProgress('جاري تحضير البيانات وتنزيل الصور...');

    const compiledMessage = getCompiledMessage();
    const selected = images.filter(img => selectedImageIds.includes(img.id));
    const fileArray: File[] = [];

    // Gather preloaded files or load missing ones
    const missing = selected.filter(img => !loadedFiles[img.id] || loadedFiles[img.id].isLoading);
    if (missing.length > 0) {
      let idx = 0;
      for (const img of selected) {
        idx++;
        const cached = loadedFiles[img.id];
        if (cached && !cached.isLoading && cached.file && cached.file.size > 0) {
          fileArray.push(cached.file);
          continue;
        }

        const percent = Math.round(((idx - 1) / selected.length) * 100);
        setShareProgress(`جاري تحميل الصور: ${idx}/${selected.length} (${percent}%)`);
        try {
          const blob = await fetchDriveFileAsBlob(img.id, settings.appsScriptUrl, settings.apiKey);
          const file = createSafeFileFromBlob(blob, idx - 1);
          fileArray.push(file);
          setLoadedFiles(prev => ({
            ...prev,
            [img.id]: { file, isLoading: false }
          }));
        } catch (e) {
          console.error('Error fetching file for share:', img.name, e);
        }
      }
    } else {
      let idx = 0;
      for (const img of selected) {
        const cached = loadedFiles[img.id];
        if (cached?.file && cached.file.size > 0) {
          fileArray.push(cached.file);
        }
        idx++;
      }
    }

    // 1. Copy description to clipboard
    try {
      await navigator.clipboard.writeText(compiledMessage);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }

    // 2. Download all selected images directly to the user's gallery
    if (fileArray.length > 0) {
      let saveIdx = 0;
      for (const file of fileArray) {
        saveIdx++;
        setShareProgress(`جاري حفظ الصورة ${saveIdx}/${fileArray.length}...`);
        try {
          const url = window.URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } catch (e) {
          console.error('Error saving cached file:', e);
        }
      }
    } else if (selected.length > 0) {
      await downloadSelectedImages();
    }

    // 3. Set nice success notification
    setShareSuccessMessage('📥 تم نسخ وصف المنتج بالكامل وحفظ كافة الصور المحددة في جهازك بنجاح! جاري فتح قناتك بالواتساب الآن لتتمكن من لصق المنشور وإرفاق الصور مباشرة كملفات مكتملة.');

    // 4. Clean Redirect to store channel URL (correct https scheme)
    const channelUrl = settings.whatsappChannelUrl.trim();
    let targetUrl = channelUrl;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    setTimeout(() => {
      try {
        const newWindow = window.open(targetUrl, '_blank');
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          window.location.href = targetUrl;
        }
      } catch (e) {
        window.location.href = targetUrl;
      }
      setIsSharing(false);
      setShareProgress('');
    }, 1200);
  };

  const handleShareGeneral = async () => {
    if (!description.trim()) {
      alert('الرجاء إدخال وصف المنتج أولاً!');
      return;
    }

    setIsSharing(true);
    setShareSuccessMessage('');
    setShareProgress('جاري تحضير البيانات...');

    const compiledMessage = getCompiledMessage();
    const selected = images.filter(img => selectedImageIds.includes(img.id));

    let sharedSuccessfully = false;
    const fileArray: File[] = [];

    // Gather preloaded files or load missing ones
    const missing = selected.filter(img => !loadedFiles[img.id] || loadedFiles[img.id].isLoading);
    if (missing.length > 0) {
      let idx = 0;
      for (const img of selected) {
        idx++;
        const cached = loadedFiles[img.id];
        if (cached && !cached.isLoading && cached.file && cached.file.size > 0) {
          fileArray.push(cached.file);
          continue;
        }

        const percent = Math.round(((idx - 1) / selected.length) * 100);
        setShareProgress(`جاري تحميل الصور المتبقية: ${idx}/${selected.length} (${percent}%)`);
        try {
          const blob = await fetchDriveFileAsBlob(img.id, settings.appsScriptUrl, settings.apiKey);
          const file = createSafeFileFromBlob(blob, idx - 1);
          fileArray.push(file);
          setLoadedFiles(prev => ({
            ...prev,
            [img.id]: { file, isLoading: false }
          }));
        } catch (e) {
          console.error('Error fetching file for share:', img.name, e);
        }
      }
    } else {
      let idx = 0;
      for (const img of selected) {
        const cached = loadedFiles[img.id];
        if (cached?.file && cached.file.size > 0) {
          fileArray.push(cached.file);
        }
        idx++;
      }
    }

    // Copy to clipboard silently as a highly compatible backup
    try {
      await navigator.clipboard.writeText(compiledMessage);
    } catch (e) {
      console.warn('Silent clipboard copy before share failed:', e);
    }

    // Try Web Share API with Files if supported
    if (navigator.share && fileArray.length > 0) {
      try {
        setShareProgress('جاري فتح قائمة تطبيقات المشاركة...');
        let canShareFiles = false;
        try {
          if (navigator.canShare) {
            canShareFiles = navigator.canShare({ files: fileArray });
          } else {
            canShareFiles = true;
          }
        } catch (e) {
          canShareFiles = true;
        }

        if (canShareFiles) {
          await navigator.share({
            files: fileArray,
            title: 'مشاركة عامة للصنف',
            text: compiledMessage
          });
          sharedSuccessfully = true;
          setShareSuccessMessage('✨ تم إطلاق نافذة المشاركة العامة بالصور والنص معاً بنجاح! شارك الصنف مع أي تطبيق أو شخص بكل سهولة.');
        }
      } catch (err: any) {
        console.error('Native share failed or canceled', err);
        if (err && (err.name === 'AbortError' || err.message?.includes('share flow was canceled') || err.message?.includes('Share canceled'))) {
          sharedSuccessfully = true;
          setShareSuccessMessage('❌ تم إلغاء عملية المشاركة.');
        }
      }
    }

    // Fallback 1: Try sharing just the text via navigator.share
    if (!sharedSuccessfully && navigator.share) {
      try {
        setShareProgress('جاري مشاركة النص...');
        await navigator.share({
          title: 'مشاركة عامة للصنف',
          text: compiledMessage
        });
        sharedSuccessfully = true;
        setShareSuccessMessage('✨ تم إطلاق مشاركة النص بنجاح! لعدم توافق مشاركة ملفات الصور مع متصفحك الحالي، يرجى حفظ الصور المرفقة ونشرها يدوياً.');
      } catch (err: any) {
        console.error('Sharing text failed:', err);
        if (err && (err.name === 'AbortError' || err.message?.includes('share flow was canceled') || err.message?.includes('Share canceled'))) {
          sharedSuccessfully = true;
          setShareSuccessMessage('❌ تم إلغاء عملية المشاركة.');
        }
      }
    }

    // Fallback 2: Copy and Download
    if (!sharedSuccessfully) {
      setShareProgress('جاري نسخ النص وتنزيل الصور...');
      try {
        const clipboardData: Record<string, Blob> = {};
        clipboardData['text/plain'] = new Blob([compiledMessage], { type: 'text/plain' });
        
        if (fileArray.length > 0) {
          clipboardData[fileArray[0].type || 'image/jpeg'] = fileArray[0];
        }
        
        if (Object.keys(clipboardData).length > 1) {
          await navigator.clipboard.write([new ClipboardItem(clipboardData)]);
        } else {
          await navigator.clipboard.writeText(compiledMessage);
        }
      } catch (err) {
        console.error('Clipboard copy failed, using fallback:', err);
        try {
          await navigator.clipboard.writeText(compiledMessage);
        } catch (e) {
          console.error('Fallback clipboard copy failed:', e);
        }
      }

      // Download from already loaded fileArray if possible
      if (fileArray.length > 0) {
        let saveIdx = 0;
        for (const file of fileArray) {
          saveIdx++;
          setShareProgress(`جاري حفظ الصورة ${saveIdx}/${fileArray.length}...`);
          try {
            const url = window.URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          } catch (e) {
            console.error('Error saving cached file:', e);
          }
        }
      } else if (selected.length > 0) {
        await downloadSelectedImages();
      }

      setShareSuccessMessage('📋 تم نسخ النص النهائي للمنشور وتنزيل كافة الصور المحددة في جهازك! يمكنك الآن لصقها ومشاركتها في أي مكان أو تطبيق تريده.');
    }

    setIsSharing(false);
    setShareProgress('');
  };

  return (
    <div className="space-y-8" id="sharing-tab-container">
      
      {/* Settings Warning Banner */}
      {!settings.appsScriptUrl && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-amber-600 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">رابط ربط السحابة غير مفعّل</h3>
              <p className="text-xs text-amber-700/90 mt-1 font-medium">يرجى إدخال رابط Google Apps Script Web App في تبويب الإعدادات للبدء بربط التطبيق والوصول المباشر دون تعقيدات تسجيل الدخول.</p>
            </div>
          </div>
        </div>
      )}

      {/* iframe notice */}
      {isInIframe && (
        <div className="bg-blue-50/80 border border-blue-150 rounded-2xl p-5 flex gap-4">
          <Info className="w-8 h-8 text-[#F27D26] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-900 font-sans">تلميح لتجربة مشاركة مثالية 📱</h3>
            <p className="text-xs text-gray-600 font-medium leading-relaxed">
              أنت تستعرض التطبيق داخل إطار المعاينة حالياً، مما يمنع إطلاق قائمة المشاركة المباشرة للنظام بالصور بسبب قيود الأمان للمتصفح داخل الإطارات الفرعية (iframes).
              <br />
              <strong className="text-[#F27D26] font-bold">للحصول على تجربة مشاركة الصور المباشرة كاملة:</strong> يرجى فتح التطبيق في نافذة مستقلة عبر النقر على زر الفتح الخارجي (أعلى اليسار)، أو استعراض الرابط من هاتفك المحمول مباشرة ومشاركة صنفك بكل سلاسة!
            </p>
          </div>
        </div>
      )}

      {/* Primary Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left pane: Description & Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-gray-900 border-b border-gray-50 pb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#F27D26]" />
              <span>إدخال بيانات المنتج والوصف</span>
            </h2>

            {/* Folder Select */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-bold">اختر المجلد لجلب صور المنتج</label>
              <div className="relative">
                <select
                  value={selectedFolder}
                  onChange={e => setSelectedFolder(e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-3 text-sm text-gray-950 outline-none appearance-none transition"
                >
                  <option value="">-- اختر مجلداً --</option>
                  {settings.folders.map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
                  <Folder className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Content Textarea */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-bold">ألصق وصف المنتج هنا (من لوحة تحكم المتجر)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={8}
                placeholder="ألصق هنا الوصف الكامل للمنتج والأسعار ورابط المنتج التابع لمتجر أم روح..."
                className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl p-4 text-sm text-gray-900 outline-none transition leading-relaxed resize-none"
              />
              <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 shrink-0 text-orange-400" />
                <span>يدعم التطبيق استقبال المشاركة التلقائية الفورية عند النقر على مشاركة من المتجر.</span>
              </p>
            </div>

            {/* 5 Types of Closing Messages Selection */}
            <div className="space-y-2 pt-2 border-t border-gray-50">
              <label className="block text-xs text-gray-500 mb-1 font-bold">اختر نوع الرسالة الختامية للمنشور</label>
              <div className="grid grid-cols-1 gap-2 max-h-[190px] overflow-y-auto custom-scrollbar p-0.5">
                {[
                  { name: "القصيدة والترحيب التراثي", desc: "التعبير الشعري الرفيع والترحيب الأصيل" },
                  { name: "خصم وعرض خاص", desc: "أكواد الخصم لتنشيط المبيعات" },
                  { name: "طريقة الطلب الفوري", desc: "تعليمات الشراء والتوصيل المباشر" },
                  { name: "متابعة قناة الواتساب", desc: "دعوة للانضمام لقناة المتجر الرسمية" },
                  { name: "جودة وضمان الصنف", desc: "تأكيد الموثوقية والخامات الفاخرة" }
                ].map((msgType, idx) => {
                  const isSelected = selectedClosingMsgIdx === idx;
                  const textPreview = settings.closingMessages?.[idx] || "";
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedClosingMsgIdx(idx)}
                      className={`text-right p-3 rounded-xl border text-xs transition cursor-pointer flex flex-col gap-1 w-full ${
                        isSelected
                          ? "bg-orange-50/70 border-[#F27D26] text-gray-950 ring-2 ring-[#F27D26]/10"
                          : "bg-white border-gray-150 text-gray-600 hover:bg-gray-50/50"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${isSelected ? "bg-[#F27D26]" : "bg-gray-300"}`} />
                          {msgType.name}
                        </span>
                        <span className="text-[9px] text-gray-400">{msgType.desc}</span>
                      </div>
                      {textPreview && (
                        <p className="text-[10px] text-gray-400 truncate w-full mt-0.5" dir="rtl">
                          {textPreview.replace(/\n/g, " ")}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
              <button
                type="button"
                onClick={handleCopyText}
                className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                title="نسخ النص النهائي المنسق بالكامل مع القصيدة وروابط الواتساب"
              >
                {copiedText ? <Check className="w-4 h-4 text-green-600" /> : <Clipboard className="w-4 h-4 text-[#F27D26]" />}
                <span>{copiedText ? 'تم نسخ النص!' : 'نسخ النص الكامل'}</span>
              </button>
              
              <button
                type="button"
                onClick={downloadSelectedImages}
                disabled={selectedImageIds.length === 0}
                className="flex-1 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 border border-gray-200 font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                title="تنزيل الصور المحددة بجهازك"
              >
                <Download className="w-4 h-4 text-[#2D5A27]" />
                <span>تحميل الصور ({selectedImageIds.length})</span>
              </button>
            </div>

            {/* Split share triggers */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleShareToChannel}
                disabled={isSharing || !description.trim()}
                className="w-full bg-[#2D5A27] hover:bg-[#1e3d1a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition shadow-lg shadow-emerald-50 cursor-pointer"
              >
                {isSharing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                    <span>{shareProgress || 'جاري التحميل...'}</span>
                  </div>
                ) : (
                  <>
                    <MessageSquare className="w-5 h-5 text-white fill-white" />
                    <span>نشر فوري بقناة المتجر 📲</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShareGeneral}
                disabled={isSharing || !description.trim()}
                className="w-full bg-[#F27D26] hover:bg-[#d96a1a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition shadow-lg shadow-orange-50 cursor-pointer"
              >
                {isSharing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                    <span>{shareProgress || 'جاري التحميل...'}</span>
                  </div>
                ) : (
                  <>
                    <Share2 className="w-5 h-5 text-white" />
                    <span>مشاركة عامة لأي مكان 🌐</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* User instruction banner */}
          {shareSuccessMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 border border-green-100 rounded-2xl p-4 flex gap-3 text-green-800 text-xs leading-relaxed font-medium"
            >
              <Check className="w-5 h-5 text-green-600 shrink-0" />
              <p>{shareSuccessMessage}</p>
            </motion.div>
          )}

        </div>

        {/* Right pane: Drive images previewer (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4 h-full flex flex-col min-h-[480px]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-50 pb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 font-sans">معاينة وتحديد صور المنتج</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">حدد الصور التي ترغب بمشاركتها مع الوصف ({selectedImageIds.length} محددة)</p>
              </div>
              
              {images.length > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    type="button" 
                    onClick={selectAllImages}
                    className="text-[10px] font-bold text-[#F27D26] bg-orange-50 hover:bg-orange-100 px-2.5 py-1.5 rounded-lg border border-orange-100 transition cursor-pointer"
                  >
                    تحديد الكل
                  </button>
                  <button 
                    type="button" 
                    onClick={deselectAllImages}
                    className="text-[10px] font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-150 transition cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              )}
            </div>

            {/* Background preloading card */}
            {!isLoadingImages && !error && selectedFolder && selectedImageIds.length > 0 && (
              <div className="bg-orange-50/40 border border-orange-100/50 rounded-2xl p-4 space-y-2 animate-fadeIn" id="preload-progress-card">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-gray-800">
                    <Sparkles className="w-4 h-4 text-[#F27D26] animate-pulse" />
                    <span>تجهيز الصور لمشاركة فائقة السرعة المباشرة:</span>
                  </div>
                  <span className="font-mono font-bold text-[#F27D26]">{overallPercent}%</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-[#F27D26] h-full transition-all duration-300"
                    style={{ width: `${overallPercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                  {overallPercent === 100 
                    ? "✨ جميع الصور المحددة محملة مسبقاً وجاهزة في ذاكرة المتصفح ليقوم زر المشاركة بنقلها فوراً كملفات حقيقية!"
                    : `📥 جاري تجهيز الصور المحددة في الخلفية (${loadedCount} من أصل ${selectedCount})... يرجى الانتظار حتى اكتمالها لتفادي التحميل اليدوي.`}
                </p>
              </div>
            )}

            {/* Search Input */}
            {!isLoadingImages && !error && selectedFolder && images.length > 0 && (
              <div className="relative mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم الصورة..."
                  className="w-full bg-gray-50 border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 outline-none transition"
                />
                <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
                  <Search className="w-4 h-4" />
                </div>
              </div>
            )}

            {/* Content Container */}
            <div className="flex-1 flex flex-col">
              
              {/* Load indicator */}
              {isLoadingImages && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3 py-16">
                  <Loader2 className="w-10 h-10 text-[#F27D26] animate-spin" />
                  <p className="text-sm font-bold">جاري جلب الصور من Google Drive...</p>
                </div>
              )}

              {/* Error banner */}
              {!isLoadingImages && error && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500 border border-dashed border-red-200 bg-red-50/50 rounded-2xl my-4">
                  <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
                  <p className="text-sm font-bold text-red-600">{error}</p>
                  <p className="text-xs text-gray-400 mt-1">تأكد من صحة إدخال المجلد في تبويب الإعدادات ومنح الصلاحيات اللازمة لجوجل درايف.</p>
                </div>
              )}

              {/* No Folder Selected state */}
              {!isLoadingImages && !error && !selectedFolder && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-gray-400 border border-dashed border-gray-200 rounded-3xl">
                  <Folder className="w-16 h-16 text-orange-200/50 mb-3" />
                  <p className="text-sm font-bold text-gray-700">يرجى اختيار مجلد من القائمة المنسدلة لبدء معاينة وتحديد الصور</p>
                  <p className="text-xs text-gray-400 mt-1">سيتم تحميل جميع صور المنتجات الموجودة داخل هذا المجلد تلقائياً.</p>
                </div>
              )}

              {/* Empty Folder state */}
              {!isLoadingImages && !error && selectedFolder && images.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-gray-400 border border-dashed border-gray-200 rounded-3xl">
                  <AlertCircle className="w-14 h-14 text-orange-200/50 mb-2" />
                  <p className="text-sm font-bold text-gray-700">المجلد فارغ!</p>
                  <p className="text-xs text-gray-400 mt-1">لم نجد أي صور داخل هذا المجلد في جوجل درايف. يمكنك رفع الصور إليه عبر تبويب "إدارة ورفع الصور".</p>
                </div>
              )}

              {/* Empty Search Results state */}
              {!isLoadingImages && !error && selectedFolder && images.length > 0 && filteredImages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-gray-400 border border-dashed border-gray-200 rounded-3xl">
                  <Search className="w-14 h-14 text-orange-200/50 mb-2" />
                  <p className="text-sm font-bold text-gray-700">لم يتم العثور على صور مطابقة للبحث!</p>
                  <p className="text-xs text-gray-400 mt-1">يرجى التأكد من كتابة الاسم بشكل صحيح أو استخدام كلمات بحث مختلفة.</p>
                </div>
              )}

              {/* Grid Layout of photos */}
              {!isLoadingImages && !error && filteredImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[480px] overflow-y-auto custom-scrollbar p-1">
                  {filteredImages.map(img => {
                    const isSelected = selectedImageIds.includes(img.id);
                    const thumbnail = getThumbnailUrl(img.id);
                    
                    return (
                      <div
                        key={img.id}
                        onClick={() => toggleImageSelection(img.id)}
                        className={`relative rounded-xl overflow-hidden bg-white border transition-all duration-300 group cursor-pointer aspect-square flex flex-col justify-between ${
                          isSelected 
                            ? 'border-[#F27D26] ring-2 ring-[#F27D26]/10 shadow-lg shadow-orange-100 scale-[0.98]' 
                            : 'border-gray-100 hover:border-gray-200 hover:scale-[1.01] shadow-sm'
                        }`}
                      >
                        {/* Image element */}
                        <img
                          src={thumbnail}
                          alt={img.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:opacity-90 transition-all"
                        />
                        
                        {/* Preloading/Loading State Overlay */}
                        {isSelected && loadedFiles[img.id]?.isLoading && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center text-white gap-1.5 transition-all">
                            <Loader2 className="w-5 h-5 animate-spin text-[#F27D26]" />
                            <span className="text-[9px] font-bold">جاري التجهيز...</span>
                          </div>
                        )}

                        {/* Preloaded success tiny indicator */}
                        {isSelected && !loadedFiles[img.id]?.isLoading && !loadedFiles[img.id]?.error && (
                          <div className="absolute bottom-8 right-2 z-10 px-1.5 py-0.5 rounded-md bg-green-500 text-white text-[8px] font-bold flex items-center gap-0.5 shadow-sm">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>جاهزة للمشاركة ⚡</span>
                          </div>
                        )}

                        {/* Selection check indicator */}
                        <div className="absolute top-2 right-2 z-10 p-1 rounded-lg bg-white border border-gray-100 shadow-md">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#F27D26]" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400 group-hover:text-gray-500" />
                          )}
                        </div>

                        {/* File Name tooltip overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm px-2 py-1.5 border-t border-gray-100 text-[10px] text-gray-700 font-bold truncate text-center group-hover:text-gray-900 transition">
                          {img.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
