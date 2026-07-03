import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings as SettingsIcon, Share2, Image, LogIn, LogOut, 
  Sparkles, Check, HelpCircle, AlertTriangle 
} from 'lucide-react';

import { Settings, DriveFolder } from './types';
import { initAuth, googleSignIn, logout } from './lib/firebase';
import SettingsTab from './components/SettingsTab';
import SharingTab from './components/SharingTab';
import MediaManagerTab from './components/MediaManagerTab';

const DEFAULT_POEM = `بين أرجاء الجمال وحسن الصنع ننفردُ،
وفي متجر أم روح نبع السعدِ يحتشدُ.
طابت لياليكم بمنتجاتنا ترفاً،
شرفٌ لنا خدمتكم، ولكم ودنا الأبدي يتّقدُ ✨`;

export default function App() {
  const [activeTab, setActiveTab] = useState<'sharing' | 'media' | 'settings'>('sharing');
  
  // App-wide Settings State
  const [settings, setSettings] = useState<Settings>({
    folders: [],
    whatsappChannelUrl: '',
    whatsappOrderUrl: '',
    closingPoem: DEFAULT_POEM
  });

  // Auth States
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Web Share Target API received text
  const [receivedSharedText, setReceivedSharedText] = useState('');

  // 1. Load settings on mount & check for share targets
  useEffect(() => {
    const saved = localStorage.getItem('um-rouh-settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to parse settings', err);
      }
    }

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
  }, []);

  // 2. Initialize Firebase Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      const errMsg = err?.message || String(err);
      if (errMsg.includes('popup-closed-by-user') || errMsg.includes('cancelled-by-user')) {
        setLoginError(
          'تم إغلاق نافذة تسجيل الدخول (Google Auth Popup). للتغلب على هذه المشكلة، يرجى السماح بالنوافذ المنبثقة في المتصفح، أو حاول فتح التطبيق في نافذة مستقلة خارج الإطار (iframe) لتسهيل الاتصال بأمان.'
        );
      } else {
        setLoginError(`فشل الاتصال بالحساب: ${errMsg}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('هل تريد بالتأكيد تسجيل الخروج من حساب جوجل؟')) {
      await logout();
      setUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
    }
  };

  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem('um-rouh-settings', JSON.stringify(newSettings));
  };

  return (
    <div className="min-h-screen bg-[#FFFBF5] text-gray-800 flex flex-col justify-between antialiased selection:bg-[#F27D26] selection:text-white font-sans" dir="rtl">
      
      {/* Decorative ambient blobs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#F27D26]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-10 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 relative z-10 flex-1">
        
        {/* Responsive Navbar / Header */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-gray-100 px-6 py-5 rounded-3xl shadow-sm">
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

          {/* User auth badge */}
          <div className="shrink-0 flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                {user.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-xl border border-orange-200 object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-gray-900 truncate max-w-[120px]">{user.displayName}</p>
                  <p className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span>متصل بالدرايف</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-[#F27D26] hover:bg-orange-50 rounded-xl transition cursor-pointer"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button cursor-pointer transition transform hover:scale-[1.02] shadow-sm"
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '16px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '18px', height: '18px' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span>ربط حساب جوجل</span>
              </button>
            )}
          </div>
        </header>

        {/* Error alert if Google login failed (e.g. popup blocked/closed in iframe) */}
        <AnimatePresence>
          {loginError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-amber-50 border border-amber-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-amber-900">تنبيه بخصوص تسجيل الدخول</h3>
                  <p className="text-xs text-amber-800/95 leading-relaxed font-bold">{loginError}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-md shadow-amber-100 cursor-pointer whitespace-nowrap"
                >
                  فتح في نافذة مستقلة
                </button>
                <button
                  type="button"
                  onClick={() => setLoginError(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2.5 px-3.5 rounded-xl transition cursor-pointer whitespace-nowrap"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                  accessToken={accessToken}
                  onLoginRequest={handleLogin}
                  initialSharedText={receivedSharedText}
                />
              )}
              
              {activeTab === 'media' && (
                <MediaManagerTab
                  settings={settings}
                  accessToken={accessToken}
                  onLoginRequest={handleLogin}
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
            <span>إصدار PWA المستقل</span>
            <span>•</span>
            <span>بأمان Firebase & Google API</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
