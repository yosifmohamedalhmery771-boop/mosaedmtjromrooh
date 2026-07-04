import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings as SettingsIcon, Share2, Image, 
  Sparkles, Check, HelpCircle, AlertTriangle 
} from 'lucide-react';

import { Settings, DriveFolder } from './types';
import SettingsTab from './components/SettingsTab';
import SharingTab from './components/SharingTab';
import MediaManagerTab from './components/MediaManagerTab';

const DEFAULT_POEM = `بين أرجاء الجمال وحسن الصنع ننفردُ،
وفي متجر أم روح نبع السعدِ يحتشدُ.
طابت لياليكم بمنتجاتنا ترفاً،
شرفٌ لنا خدمتكم، ولكم ودنا الأبدي يتّقدُ ✨`;

const DEFAULT_CLOSING_MESSAGES = [
  `بين أرجاء الجمال وحسن الصنع ننفردُ،\nوفي متجر أم روح نبع السعدِ يحتشدُ.\nطابت لياليكم بمنتجاتنا ترفاً،\nشرفٌ لنا خدمتكم، ولكم ودنا الأبدي يتّقدُ ✨`,
  `يسعدنا تقديم كود خصم خاص (OMROUH5) لزيارتكم القادمة! 🎁\nنحن فخورون بكونكم جزءاً من عائلتنا الراقية.`,
  `للطلب والاستفسار السريع، تفضلوا بمراسلتنا مباشرة بالضغط على رابط الطلب السريع 💬\nنوفر شحن آمن وسريع لجميع مدن ومناطق مملكتنا الغالية 🚚`,
  `نسعى دوماً لتقديم كل ما يليق بجمالكم وسحر حضوركم 🌸\nلا تفوتوا جديد تصاميمنا الحصرية بالانضمام لقناتنا الرسمية على الواتساب 📲`,
  `جميع منتجاتنا مصممة بدقة متناهية وبجودة مضمونة تناسب تطلعاتكم العالية ✨\nمتجر أم روح.. حيث ينبض الرقي في أدق التفاصيل.`
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'sharing' | 'media' | 'settings'>('sharing');
  
  // App-wide Settings State
  const [settings, setSettings] = useState<Settings>({
    folders: [],
    whatsappChannelUrl: '',
    whatsappOrderUrl: '',
    closingPoem: DEFAULT_POEM,
    closingMessages: DEFAULT_CLOSING_MESSAGES,
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbychcCW3ycX_Eptt_6iavMzPnq5_lLQIpAaOUOAHR4ZhKDMemPAFeRavrLuEvkwq8jj/exec',
    apiKey: 'um_rouh_secret_key',
    adminPin: '1234'
  });

  // Web Share Target API received text
  const [receivedSharedText, setReceivedSharedText] = useState('');

  // PWA installation state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // 1. Load settings on mount & check for share targets & capture install prompt
  useEffect(() => {
    const saved = localStorage.getItem('um-rouh-settings');
    const defaultUrl = 'https://script.google.com/macros/s/AKfycbychcCW3ycX_Eptt_6iavMzPnq5_lLQIpAaOUOAHR4ZhKDMemPAFeRavrLuEvkwq8jj/exec';
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // Migrate old default Apps Script URL to the new active one
        let loadedUrl = parsed.appsScriptUrl || defaultUrl;
        if (loadedUrl.includes('AKfycbykYeGI-EX7ZQNR9SeFXq7yfeh6laHphcMyn-are__tcFfV7Px7kMy5-nAEQwCBW1Ry2w')) {
          loadedUrl = defaultUrl;
        }

        setSettings({
          folders: parsed.folders || [],
          whatsappChannelUrl: parsed.whatsappChannelUrl || '',
          whatsappOrderUrl: parsed.whatsappOrderUrl || '',
          closingPoem: parsed.closingPoem || DEFAULT_POEM,
          closingMessages: parsed.closingMessages && parsed.closingMessages.length === 5 
            ? parsed.closingMessages 
            : DEFAULT_CLOSING_MESSAGES,
          appsScriptUrl: loadedUrl,
          apiKey: parsed.apiKey !== undefined ? parsed.apiKey : 'um_rouh_secret_key',
          adminPin: parsed.adminPin || '1234'
        });
      } catch (err) {
        console.error('Failed to parse settings', err);
      }
    }

    // Capture PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Parse URL search parameters for Web Share Target GET payload
    const params = new URLSearchParams(window.location.search);
    const textParam = params.get('text') || '';
    const titleParam = params.get('title') || '';
    const urlParam = params.get('url') || '';

    let shareMessage = textParam || titleParam;
    if (urlParam) {
      shareMessage = shareMessage ? `${shareMessage}\n${urlParam}` : urlParam;
    }

    if (shareMessage) {
      setReceivedSharedText(shareMessage);
      setActiveTab('sharing'); // Auto switch to sharing tab
      
      // Clean up URL without losing the rest of state
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      setDeferredPrompt(null);
      setIsInstallable(false);
    } else {
      alert('التطبيق جاهز ومثبّت بالفعل أو يعمل داخل المتصفح مباشرة! لتثبيته وتكراره يدوياً، انقر على زر خيارات المتصفح (المزيد) ثم اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen) أو "تثبيت التطبيق".');
    }
  };

  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem('um-rouh-settings', JSON.stringify(newSettings));
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FFFBF5] text-gray-800 flex flex-col justify-between antialiased selection:bg-[#F27D26] selection:text-white font-sans" dir="rtl">
      
      {/* Decorative ambient blobs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#F27D26]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-10 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 relative z-10 flex-1">
        
        {/* Responsive Navbar / Header */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white border border-gray-100 px-6 py-5 rounded-3xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#F27D26] to-amber-500 rounded-2xl blur-sm opacity-30" />
              <div className="relative p-3 bg-[#F27D26] text-white rounded-2xl shadow-lg shadow-orange-100 shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <span>متجر أم روح</span>
                <span className="text-xs font-bold px-2.5 py-1 bg-orange-50 text-[#F27D26] rounded-lg border border-orange-100">الناشر الذكي</span>
              </h1>
              <p className="text-xs text-gray-500 mt-1 font-sans font-medium">بوابة أتمتة نشر المنتجات وإدارة صور جوجل درايف المتكاملة</p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="shrink-0 flex flex-wrap items-center justify-center gap-3">
            {/* Install Button */}
            <button
              type="button"
              onClick={handleInstallApp}
              className="flex items-center gap-2 bg-[#F27D26]/10 hover:bg-[#F27D26]/25 border border-[#F27D26]/20 text-[#F27D26] px-4 py-2 rounded-2xl text-xs font-bold transition shadow-sm cursor-pointer"
              title="تثبيت التطبيق على الشاشة الرئيسية"
            >
              <span className="text-sm">📲</span>
              <span>تثبيت التطبيق</span>
            </button>

            {/* Google Apps Script status badge */}
            {settings.appsScriptUrl ? (
              <div className="flex items-center gap-2.5 bg-green-50/70 border border-green-100 px-4 py-2 rounded-2xl">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <div className="text-right">
                  <p className="text-[11px] font-bold text-green-900 leading-tight">الربط السحابي مفعّل</p>
                  <p className="text-[9px] text-green-600/90 font-mono" dir="ltr">Apps Script API</p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-2xl text-xs font-bold transition shadow-sm cursor-pointer animate-pulse"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>يرجى تهيئة ربط السحابة</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Tab Switcher */}
        <div className="flex bg-white border border-gray-100 p-1.5 rounded-2xl w-full sm:max-w-md mx-auto relative shadow-sm shrink-0">
          <button
            onClick={() => setActiveTab('sharing')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'sharing'
                ? 'bg-[#F27D26] text-white shadow-lg shadow-orange-100'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Share2 className="w-4.5 h-4.5" />
            <span>تجهيز النشر</span>
          </button>
          
          <button
            onClick={() => setActiveTab('media')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'media'
                ? 'bg-[#F27D26] text-white shadow-lg shadow-orange-100'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Image className="w-4.5 h-4.5" />
            <span>مدير الوسائط</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#F27D26] text-white shadow-lg shadow-orange-100'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <SettingsIcon className="w-4.5 h-4.5" />
            <span>الإعدادات</span>
          </button>
        </div>

        {/* Tab Viewport with slide/fade entries */}
        <main className="min-h-[420px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === 'sharing' && (
                <SharingTab
                  settings={settings}
                  initialSharedText={receivedSharedText}
                />
              )}
              
              {activeTab === 'media' && (
                <MediaManagerTab
                  settings={settings}
                  onFoldersChanged={() => {}}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab
                  settings={settings}
                  onSave={handleSaveSettings}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>

      {/* Styled Footer */}
      <footer className="w-full bg-white border-t border-gray-100 py-6 mt-12 shrink-0">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-2">
          <p className="text-xs text-gray-500 font-sans font-medium leading-relaxed">
            جميع الحقوق محفوظة لمتجر أم روح © 2026. طُورت الأداة لتسهيل أعمالكم وزيادة بهاء متجركم الفاخر.
          </p>
          <div className="flex justify-center gap-2 text-[10px] text-gray-400 font-mono">
            <span>إصدار PWA المستقل السريع</span>
            <span>•</span>
            <span>بأمان Google Apps Script API Gateway</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
