import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Folder, Send, MessageSquare, Clipboard, Download, Share2, 
  CheckSquare, Square, Loader2, Sparkles, Check, AlertCircle, Info, Search
} from 'lucide-react';
import { Settings, DriveFolder, DriveFile } from '../types';
import { listFolderImages, getThumbnailUrl, fetchDriveFileAsBlob } from '../lib/drive';

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
  const [shareSuccessMessage, setShareSuccessMessage] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  // Selected closing message index (0 to 4)
  const [selectedClosingMsgIdx, setSelectedClosingMsgIdx] = useState<number>(0);

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
        const blob = await fetchDriveFileAsBlob(img.id, settings.appsScriptUrl, settings.apiKey);
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

    setIsSharing(true);
    setShareSuccessMessage('');

    const compiledMessage = getCompiledMessage();
    const selected = images.filter(img => selectedImageIds.includes(img.id));

    // Try Web Share API with Files if supported
    if (navigator.share && navigator.canShare && selected.length > 0) {
      try {
        const fileArray: File[] = [];
        
        for (const img of selected) {
          try {
            const blob = await fetchDriveFileAsBlob(img.id, settings.appsScriptUrl, settings.apiKey);
            const file = new File([blob], img.name, { type: blob.type || 'image/jpeg' });
            fileArray.push(file);
          } catch (e) {
            console.error('Error fetching file for share:', img.name, e);
          }
        }

        if (fileArray.length > 0 && navigator.canShare({ files: fileArray })) {
          await navigator.share({
            files: fileArray,
            title: 'نشر في قناة الواتساب',
            text: compiledMessage
          });
          setShareSuccessMessage('✨ تم إطلاق مشاركة النظام السريعة! يمكنك الآن اختيار تطبيق واتساب ونشر الصنف فوراً في قناتك دون أي تبويبات خارجية.');
          setIsSharing(false);
          return;
        }
      } catch (err) {
        console.error('Native share failed or canceled', err);
      }
    }

    // Fallback/Desktop: copy + download completely in-app (no window.open)
    try {
      await navigator.clipboard.writeText(compiledMessage);
    } catch (err) {
      console.error('Clipboard copy failed', err);
    }

    if (selected.length > 0) {
      await downloadSelectedImages();
    }

    setShareSuccessMessage('📥 تم نسخ وصف المنتج بالكامل وتنزيل الصور المحددة إلى جهازك تلقائياً وبأمان! جاهز للنشر الفوري في قناتك بالواتساب الآن دون فتح تبويبات إضافية.');
    setIsSharing(false);
  };

  const handleShareGeneral = async () => {
    if (!description.trim()) {
      alert('الرجاء إدخال وصف المنتج أولاً!');
      return;
    }

    setIsSharing(true);
    setShareSuccessMessage('');

    const compiledMessage = getCompiledMessage();
    const selected = images.filter(img => selectedImageIds.includes(img.id));

    // Try Web Share API with Files if supported
    if (navigator.share && navigator.canShare && selected.length > 0) {
      try {
        const fileArray: File[] = [];
        
        for (const img of selected) {
          try {
            const blob = await fetchDriveFileAsBlob(img.id, settings.appsScriptUrl, settings.apiKey);
            const file = new File([blob], img.name, { type: blob.type || 'image/jpeg' });
            fileArray.push(file);
          } catch (e) {
            console.error('Error fetching file for share:', img.name, e);
          }
        }

        if (fileArray.length > 0 && navigator.canShare({ files: fileArray })) {
          await navigator.share({
            files: fileArray,
            title: 'مشاركة عامة للصنف',
            text: compiledMessage
          });
          setShareSuccessMessage('✨ تم إطلاق نافذة المشاركة العامة بنجاح! شارك الصنف مع أي تطبيق أو شخص بكل سهولة.');
          setIsSharing(false);
          return;
        }
      } catch (err) {
        console.error('Native share failed or canceled', err);
      }
    }

    // Fallback: Copy and Download
    try {
      await navigator.clipboard.writeText(compiledMessage);
    } catch (err) {
      console.error('Clipboard copy failed', err);
    }

    if (selected.length > 0) {
      await downloadSelectedImages();
    }

    setShareSuccessMessage('📋 تم نسخ النص النهائي للمنشور وتنزيل كافة الصور المحددة في جهازك! يمكنك الآن لصقها ومشاركتها في أي مكان أو تطبيق تريده.');
    setIsSharing(false);
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
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <MessageSquare className="w-5 h-5 text-white fill-white" />
                )}
                <span>نشر فوري بقناة المتجر 📲</span>
              </button>

              <button
                type="button"
                onClick={handleShareGeneral}
                disabled={isSharing || !description.trim()}
                className="w-full bg-[#F27D26] hover:bg-[#d96a1a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition shadow-lg shadow-orange-50 cursor-pointer"
              >
                {isSharing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Share2 className="w-5 h-5 text-white" />
                )}
                <span>مشاركة عامة لأي مكان 🌐</span>
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
