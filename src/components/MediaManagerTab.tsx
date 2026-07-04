import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Folder, UploadCloud, Copy, Edit3, Trash2, Check, CheckCircle2, 
  Loader2, AlertCircle, RefreshCw, Eye, FileText, CheckSquare, X 
} from 'lucide-react';
import { Settings, DriveFolder, DriveFile } from '../types';
import { 
  listFolderImages, renameDriveFile, deleteDriveFile, 
  uploadImageToDrive, getDirectLink, getThumbnailUrl 
} from '../lib/drive';

interface MediaManagerTabProps {
  settings: Settings;
  onFoldersChanged: () => void;
}

export default function MediaManagerTab({ settings, onFoldersChanged }: MediaManagerTabProps) {
  // Explorer state
  const [activeFolderId, setActiveFolderId] = useState<string>('');
  const [explorerImages, setExplorerImages] = useState<DriveFile[]>([]);
  const [isLoadingExplorer, setIsLoadingExplorer] = useState(false);
  const [explorerError, setExplorerError] = useState('');

  // Upload state
  const [uploadFolderId, setUploadFolderId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customFileName, setCustomFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Actions state
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);

  // Sync default active folder when settings loads
  useEffect(() => {
    if (settings.folders.length > 0 && !activeFolderId) {
      setActiveFolderId(settings.folders[0].id);
      setUploadFolderId(settings.folders[0].id);
    }
  }, [settings, activeFolderId]);

  // Load explorer images when active tab changes
  useEffect(() => {
    if (!activeFolderId) {
      setExplorerImages([]);
      return;
    }

    fetchFolderImages();
  }, [activeFolderId, settings.appsScriptUrl, settings.apiKey]);

  const fetchFolderImages = async () => {
    if (!activeFolderId) return;
    if (!settings.appsScriptUrl) {
      setExplorerError('يرجى تهيئة رابط اتصال Google Apps Script في الإعدادات أولاً لعرض صور المجلد.');
      return;
    }
    setIsLoadingExplorer(true);
    setExplorerError('');
    try {
      const files = await listFolderImages(activeFolderId, settings.appsScriptUrl, settings.apiKey);
      setExplorerImages(files);
    } catch (err: any) {
      console.error('Explorer fetch error:', err);
      setExplorerError(err?.message || 'فشل جلب الملفات من درايف. تأكد من صحة إعدادات Google Apps Script ومعرّف المجلد.');
    } finally {
      setIsLoadingExplorer(false);
    }
  };

  // Upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      // Auto fill custom file name (without extension)
      const dotIndex = file.name.lastIndexOf('.');
      const nameWithoutExt = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
      setCustomFileName(nameWithoutExt);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess(false);

    if (!settings.appsScriptUrl) {
      setUploadError('يرجى تهيئة رابط اتصال Google Apps Script في الإعدادات أولاً.');
      return;
    }
    if (!uploadFolderId) {
      setUploadError('يرجى اختيار مجلد لرفع الصورة إليه.');
      return;
    }
    if (!selectedFile) {
      setUploadError('يرجى اختيار ملف صورة أولاً.');
      return;
    }
    if (!customFileName.trim()) {
      setUploadError('يرجى كتابة اسم مخصص للصورة.');
      return;
    }

    setIsUploading(true);
    try {
      // Keep file extension from original file
      const originalExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.'));
      const uploadName = customFileName.trim() + originalExt;

      await uploadImageToDrive(uploadFolderId, selectedFile, uploadName, settings.appsScriptUrl, settings.apiKey);
      
      setUploadSuccess(true);
      setSelectedFile(null);
      setCustomFileName('');
      
      // Auto switch the file explorer tab to the folder that was uploaded to and trigger auto-refresh
      if (uploadFolderId === activeFolderId) {
        fetchFolderImages();
      } else {
        setActiveFolderId(uploadFolderId);
      }
    } catch (err: any) {
      console.error('File upload failed:', err);
      setUploadError(err?.message || 'حدث خطأ أثناء رفع الصورة إلى درايف. يرجى المحاولة لاحقاً.');
    } finally {
      setIsUploading(false);
    }
  };

  // Copy direct link trigger
  const handleCopyLink = async (fileId: string) => {
    const directLink = getDirectLink(fileId);
    try {
      await navigator.clipboard.writeText(directLink);
      setCopiedFileId(fileId);
      setTimeout(() => setCopiedFileId(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Delete Drive file handler (Workspace integration mandate confirmation!)
  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!settings.appsScriptUrl) {
      alert('يرجى تهيئة رابط اتصال Google Apps Script أولاً.');
      return;
    }
    
    // EXPLICIT CONFIRM DIALOG as mandated by system instructions!
    const isConfirmed = window.confirm(
      `تنبيه هام! هل أنت متأكد من رغبتك في حذف الصورة "${fileName}" نهائياً من حساب Google Drive الخاص بك؟ لا يمكن التراجع عن هذا الإجراء.`
    );
    if (!isConfirmed) return;

    try {
      await deleteDriveFile(fileId, settings.appsScriptUrl, settings.apiKey);
      // Remove from state immediately
      setExplorerImages(prev => prev.filter(f => f.id !== fileId));
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert(`فشل حذف الملف: ${err?.message || 'خطأ غير معروف'}`);
    }
  };

  // Rename modal launcher
  const startRenameFlow = (file: DriveFile) => {
    // Remove extension for display in input
    const dotIndex = file.name.lastIndexOf('.');
    const nameWithoutExt = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
    setEditingFileId(file.id);
    setEditingFileName(nameWithoutExt);
  };

  const handleRenameSubmit = async () => {
    if (!settings.appsScriptUrl || !editingFileId || !editingFileName.trim()) return;

    // Fetch original file details to restore extension
    const file = explorerImages.find(f => f.id === editingFileId);
    if (!file) return;

    setIsRenaming(true);
    try {
      const dotIndex = file.name.lastIndexOf('.');
      const originalExt = dotIndex !== -1 ? file.name.substring(dotIndex) : '';
      const finalName = editingFileName.trim() + originalExt;

      await renameDriveFile(editingFileId, finalName, settings.appsScriptUrl, settings.apiKey);
      
      // Update local state
      setExplorerImages(prev => prev.map(f => f.id === editingFileId ? { ...f, name: finalName } : f));
      
      setEditingFileId(null);
      setEditingFileName('');
    } catch (err: any) {
      console.error('Rename failed:', err);
      alert(`فشل تعديل الاسم: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <div className="space-y-8" id="media-manager-tab-container">
      
      {/* Settings Warning Banner */}
      {!settings.appsScriptUrl && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-amber-600 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">رابط ربط السحابة غير مفعّل</h3>
              <p className="text-xs text-amber-700/90 mt-1 font-medium">يرجى إدخال رابط Google Apps Script Web App في تبويب الإعدادات لرفع وإدارة وصيانة صورك السحابية بنجاح.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Quick Upload Form (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="border-b border-gray-50 pb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-[#F27D26]" />
                <span>رفع صور إلى جوجل درايف</span>
              </h2>
              <p className="text-xs text-gray-500 font-medium mt-1">ارفع الصور مباشرة للمجلد المناسب بالمتجر</p>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Select Destination Folder */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-bold">مجلد الرفع المستهدف</label>
                <select
                  value={uploadFolderId}
                  onChange={e => setUploadFolderId(e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none"
                >
                  <option value="">-- اختر مجلد درايف --</option>
                  {settings.folders.map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </div>

              {/* Custom Image Name */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-bold">اسم الصورة المخصص قبل الرفع</label>
                <input
                  type="text"
                  value={customFileName}
                  onChange={e => setCustomFileName(e.target.value)}
                  placeholder="مثال: فستان سهرة مخملي أحمر..."
                  className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none transition"
                />
              </div>

              {/* File input box */}
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-bold">اختر ملف الصورة من جهازك</label>
                <div className="border-2 border-dashed border-gray-200 hover:border-[#F27D26]/40 rounded-2xl bg-gray-50/50 p-6 text-center transition cursor-pointer relative group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  <div className="space-y-2">
                    <UploadCloud className="w-10 h-10 text-gray-400 group-hover:text-[#F27D26] mx-auto transition" />
                    {selectedFile ? (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-900 truncate max-w-[200px] mx-auto">{selectedFile.name}</p>
                        <p className="text-[10px] text-gray-500 font-bold">{(selectedFile.size / (1024 * 1024)).toFixed(2)} ميغابايت</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-700">اسحب الملف وأفلته أو تصفّح</p>
                        <p className="text-[10px] text-gray-400 font-medium">يدعم صيغ JPG, PNG, WEBP حتى 15 ميغابايت</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {uploadError && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3.5 flex gap-2.5 text-red-800 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccess && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3.5 flex gap-2.5 text-green-800 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
                  <span>تم رفع وحفظ الصورة بنجاح على Google Drive! ✨</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isUploading || !settings.appsScriptUrl || !selectedFile}
                className="w-full bg-[#F27D26] hover:bg-[#d96a1a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition shadow-lg shadow-orange-100 cursor-pointer"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                <span>حفظ ورفع الصورة</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Folder Explorer (8 cols) */}
        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-6 flex-1 flex flex-col min-h-[500px]">
            
            {/* Horizontal Tabs for Folders */}
            <div className="border-b border-gray-50 pb-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900 font-sans">متصفح ملفات جوجل درايف</h2>
                <p className="text-xs text-gray-500 font-medium mt-0.5">تصفح صور منتجاتك وانسخ روابطها لمتجرك بسهولة</p>
              </div>
            </div>

            {/* Folder Tabs List */}
            {settings.folders.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs">
                يرجى إضافة مجلدات درايف في الإعدادات أولاً لعرضها هنا.
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-50 custom-scrollbar shrink-0">
                {settings.folders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => setActiveFolderId(folder.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap border cursor-pointer ${
                      activeFolderId === folder.id
                        ? 'bg-[#F27D26] text-white border-[#F27D26] shadow-lg shadow-orange-100'
                        : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {folder.name}
                  </button>
                ))}
              </div>
            )}

            {/* Main content display */}
            <div className="flex-1 flex flex-col">
              
              {/* Loader */}
              {isLoadingExplorer && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
                  <Loader2 className="w-10 h-10 text-[#F27D26] animate-spin" />
                  <p className="text-sm font-bold text-gray-500">جاري تحميل الملفات من درايف...</p>
                </div>
              )}

              {/* Error banner */}
              {!isLoadingExplorer && explorerError && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500 border border-dashed border-red-200 bg-red-50/50 rounded-2xl my-4">
                  <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
                  <p className="text-sm font-bold text-red-600">{explorerError}</p>
                  <p className="text-xs text-gray-400 mt-1">يرجى التأكد من أن حساب جوجل المسجل يمتلك صلاحيات لعرض هذا المجلد.</p>
                </div>
              )}

              {/* No Folder selected empty status */}
              {!isLoadingExplorer && !explorerError && !activeFolderId && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-gray-400">
                  <Folder className="w-14 h-14 text-orange-200/50 mb-2" />
                  <p className="text-xs font-bold text-gray-700">اختر مجلداً من التبويبات أعلاه لاستعراض الصور وإدارتها</p>
                </div>
              )}

              {/* Empty folder image list */}
              {!isLoadingExplorer && !explorerError && activeFolderId && explorerImages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 text-gray-400 border border-dashed border-gray-250 rounded-2xl">
                  <AlertCircle className="w-12 h-12 text-orange-200/50 mb-2" />
                  <p className="text-sm font-bold text-gray-700">لا توجد صور في هذا المجلد!</p>
                  <p className="text-xs text-gray-400 mt-1">استخدم نموذج الرفع الملاصق على اليمين لرفع الصور فوراً.</p>
                </div>
              )}

              {/* Loaded files Grid */}
              {!isLoadingExplorer && !explorerError && explorerImages.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 max-h-[520px] overflow-y-auto custom-scrollbar p-1">
                  {explorerImages.map(img => {
                    const isCopied = copiedFileId === img.id;
                    const directLink = getDirectLink(img.id);
                    const thumbnail = getThumbnailUrl(img.id);

                    return (
                      <div
                        key={img.id}
                        className="bg-white border border-gray-150 hover:border-gray-250 rounded-2xl p-3 flex flex-col justify-between transition group space-y-3 shadow-sm"
                      >
                        {/* Image Frame */}
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                          <img
                            src={thumbnail}
                            alt={img.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        </div>

                        {/* Metadata Details */}
                        <div className="space-y-2 flex-1 flex flex-col justify-between">
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-gray-900 truncate px-1" title={img.name}>
                              {img.name}
                            </h4>
                            <p className="text-[9px] text-gray-400 font-mono truncate px-1" dir="ltr">
                              {img.id}
                            </p>
                          </div>

                          {/* Action Panel Buttons */}
                          <div className="space-y-1.5 pt-2 border-t border-gray-50">
                            {/* Link copying block */}
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                readOnly
                                value={directLink}
                                className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[9px] text-gray-500 font-mono flex-1 outline-none truncate"
                                dir="ltr"
                              />
                              <button
                                type="button"
                                onClick={() => handleCopyLink(img.id)}
                                className={`p-1.5 rounded-lg border transition cursor-pointer shrink-0 ${
                                  isCopied
                                    ? 'bg-green-50 text-green-600 border-green-100 font-bold'
                                    : 'bg-white text-gray-400 border-gray-150 hover:text-[#F27D26] hover:border-[#F27D26]/40'
                                }`}
                                title="نسخ رابط مباشر للمتجر"
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {/* Edit/Delete triggers */}
                            <div className="flex gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => startRenameFlow(img)}
                                className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl py-1.5 text-[10px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#F27D26]" />
                                <span>تعديل الاسم</span>
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleDeleteFile(img.id, img.name)}
                                className="flex-1 bg-gray-50 hover:bg-red-50 text-gray-700 border border-gray-200 hover:text-red-600 hover:border-red-200 rounded-xl py-1.5 text-[10px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                <span>حذف نهائي</span>
                              </button>
                            </div>
                          </div>
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

      {/* Rename File Dialog Modal overlay */}
      <AnimatePresence>
        {editingFileId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-gray-150 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#F27D26]" />
                  <span>تعديل اسم الصورة الفوري</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingFileId(null)}
                  className="p-1 text-gray-400 hover:text-gray-950 rounded-lg hover:bg-gray-50 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-gray-500 mb-1 font-bold">اسم الصورة الجديد</label>
                <input
                  type="text"
                  value={editingFileName}
                  onChange={e => setEditingFileName(e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-[#F27D26] focus:ring-2 focus:ring-[#F27D26]/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none transition"
                  placeholder="أدخل اسم الصورة الجديد..."
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleRenameSubmit}
                  disabled={isRenaming || !editingFileName.trim()}
                  className="flex-1 bg-[#F27D26] hover:bg-[#d96a1a] disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-orange-100 cursor-pointer"
                >
                  {isRenaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>تحديث وحفظ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingFileId(null)}
                  className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
