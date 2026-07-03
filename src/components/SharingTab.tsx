import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Folder, Send, MessageSquare, Clipboard, Download, Share2, 
  CheckSquare, Square, Loader2, Sparkles, Check, AlertCircle, Info 
} from 'lucide-react';
import { Settings, DriveFolder, DriveFile } from '../types';
import { listFolderImages, getThumbnailUrl } from '../lib/drive';

interface SharingTabProps {
  settings: Settings;
  accessToken: string | null;
  onLoginRequest: () => void;
  initialSharedText?: string;
}

export default function SharingTab({ settings, accessToken, onLoginRequest, initialSharedText = '' }: SharingTabProps) {
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [images, setImages] = useState<DriveFile[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [description, setDescription] = useState(initialSharedText);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [error, setError] = useState('');
  
  // Feedback states
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccessMessage, setShareSuccessMessage] = useState('');
  const [copiedText, setCopiedText] = useState(false);

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

    if (!accessToken) {
      setError('الرجاء تسجيل الدخول أولاً باستخدام حساب جوجل المخول للوصول إلى Google Drive.');
      return;
    }

    const fetchImages = async () => {
      setIsLoadingImages(true);
      setError('');
      setSelectedImageIds([]);
      try {
        const driveImages = await listFolderImages(selectedFolder, accessToken);
        setImages(driveImages);
      } catch (err: any) {
        console.error('Error fetching images:', err);
        setError(err?.message || 'فشل جلب الصور من المجلد المحدد. تأكد من إعدادات المشاركة للمجلد وصحة معرّفه.');
      } finally {
        setIsLoadingImages(false);
      }
    };

    fetchImages();
  }, [selectedFolder, accessToken]);

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
    
    const poemBlock = settings.closingPoem 
      ? `\n\n${settings.closingPoem}` 
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

    for (const img of selected) {
      try {
        // Fetch original file content or download link
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${img.id}`;
        const response = await fetch(downloadUrl);
        const blob = await response.blob();
        
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
        // Fallback: Open in new tab
        window.open(`https://drive.google.com/uc?export=download&id=${img.id}`, '_blank');
      }
    }
  };

  const handleShareToWhatsApp = async () => {
    if (!description.trim()) {
      alert('الرجاء إدخال وصف المنتج أولاً!');
      return;
    }

    setIsSharing(true);
    setShareSuccessMessage('');

    const compiledMessage = getCompiledMessage();
    const selected = images.filter(img => selectedImageIds.includes(img.id));

    // Try Web Share API with Files if on mobile and supported
    if (navigator.share && navigator.canShare && selected.length > 0) {
      try {
        const fileArray: File[] = [];
        
        // Fetch files to build Blob and File objects for native sharing
        for (const img of selected) {
          const downloadUrl = `https://drive.google.com/uc?export=download&id=${img.id}`;
          const res = await fetch(downloadUrl);
          const blob = await res.blob();
          const file = new File([blob], img.name, { type: blob.type || 'image/jpeg' });
          fileArray.push(file);
        }

        if (navigator.canShare({ files: fileArray })) {
          await navigator.share({
            files: fileArray,
            title: 'منتج جديد من متجر أم روح',
            text: compiledMessage
          });
          setShareSuccessMessage('تم تفعيل المشاركة المباشرة بنجاح! ✨');
          setIsSharing(false);
          return;
        }
      } catch (err) {
        console.error('Native share failed or canceled', err);
      }
    }

    // Desktop/Fallback mechanism:
    // 1. Copy text to clipboard
    try {
      await navigator.clipboard.writeText(compiledMessage);
    } catch (err) {
      console.error('Clipboard copy failed', err);
    }

    // 2. Download selected images
    if (selected.length > 0) {
      await downloadSelectedImages();
    }

    // 3. Show dynamic instructions modal
    setShareSuccessMessage('تم نسخ النص المنسق بالكامل وتنزيل الصور المحددة بجهازك! سيتم توجيهك الآن إلى واتساب لإرفاق الصور ولصق النص.');

    // 4. Open WhatsApp
    setTimeout(() => {
      // Use clean URL for Whatsapp
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(compiledMessage)}`;
      window.open(waUrl, '_blank');
      setIsSharing(false);
    }, 3000);
  };

  return (
    <div className="space-y-8" id="sharing-tab-container">
      
      {/* Auth Guard Banner */}
      {!accessToken && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-amber-600 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">الوصول إلى صور Google Drive غير مفعّل</h3>
              <p className="text-xs text-amber-700/90 mt-1 font-medium">يتطلب هذا التبويب تسجيل الدخول بحساب جوجل للوصول إلى المجلدات والملفات المخزنة وعرض صور منتجاتك.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLoginRequest}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition shrink-0 shadow-md cursor-pointer"
          >
            تسجيل الدخول الآن
          </button>
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

            {/* Big WhatsApp share trigger */}
            <button
              type="button"
              onClick={handleShareToWhatsApp}
              disabled={isSharing || !accessToken || !description.trim()}
              className="w-full bg-[#2D5A27] hover:bg-[#1e3d1a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition shadow-lg shadow-emerald-100 cursor-pointer"
            >
              {isSharing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <MessageSquare className="w-5 h-5 text-white fill-white" />
              )}
              <span>مشاركة عبر الواتساب</span>
            </button>
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

              {/* Grid Layout of photos */}
              {!isLoadingImages && !error && images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[480px] overflow-y-auto custom-scrollbar p-1">
                  {images.map(img => {
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
