
import { Fingerprint, RefreshCcw, ShieldAlert, Trash2, X, Shield, Smartphone, Bell, ShieldCheck, Download, Upload, FileLock, Check, Activity, Lock, Key, Eye, EyeOff, ExternalLink, Zap, Crown, FileText, Loader2, Palette, AlertTriangle, CheckCircle2 } from 'lucide-react';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { CreditCard, AppTheme } from '../types';
import { 
  getBiometricEnrolled, 
  setBiometricEnrolled, 
  wipeEverything, 
  getNotificationPeriod,
  setNotificationPeriod,
  enrollBiometricsWithKey,
  exportEncryptedBackup,
  importEncryptedBackup,
  saveCards,
  runStorageIntegrityCheck,
  getDecryptedApiKey,
  saveEncryptedApiKey,
  APP_VERSION,
  getProStatus,
  setProStatus,
  getAdvisorUsage,
  restoreSettings,
  getThemeColor,
  setThemeColor
} from '../utils/storage';
import { THEME_PALETTES } from '../constants';
import { checkPrivacyFilterIntegrity } from '../services/geminiService';
import SecurityAuth from './SecurityAuth';
import PrivacyScreen from './PrivacyScreen';
import { UI_STRINGS } from '../locales/en';
import { requestPermission } from '../utils/notifications';

interface SettingsModalProps {
  cards: CreditCard[];
  onCardsSynced: (newCards: CreditCard[]) => void;
  onClose: () => void;
  masterKey: Uint8Array;
  onNotifPeriodChange?: (months: number) => void;
  onThemeChange?: (theme: AppTheme) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ cards, onClose, masterKey, onNotifPeriodChange, onCardsSynced, onThemeChange }) => {
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);
  const [notifPeriod, setNotifPeriod] = useState(2);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [showMpinReset, setShowMpinReset] = useState(false);
  const [showPrivacyScreen, setShowPrivacyScreen] = useState(false);
  const [showBioAuth, setShowBioAuth] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<AppTheme>('Blue');
  
  // Pro / Monetization State
  const [isPro, setIsPro] = useState(false);
  const [advisorUsage, setAdvisorUsage] = useState({ count: 0, limit: 20 });
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);

  // API Key State
  const [apiKey, setApiKey] = useState('');
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // Backup States
  const [backupMode, setBackupMode] = useState<'export' | 'import' | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [isProcessingBackup, setIsProcessingBackup] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security Health State
  const [health, setHealth] = useState<{
    keysSecure: boolean;
    storageClean: boolean;
    aiFilterActive: boolean;
    leaks: string[];
    loading: boolean;
  }>({
    keysSecure: false,
    storageClean: false,
    aiFilterActive: false,
    leaks: [],
    loading: true
  });

  // Load async settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const bio = await getBiometricEnrolled();
        setIsBiometricEnrolled(!!bio);
        
        const np = await getNotificationPeriod();
        setNotifPeriod(np);
        
        const proStatus = await getProStatus();
        setIsPro(proStatus);
        
        const usage = await getAdvisorUsage();
        setAdvisorUsage({ count: usage.count, limit: usage.limit });

        const theme = await getThemeColor();
        setCurrentTheme(theme);

        // Decrypt the stored API key in memory to show it (masked)
        const storedKey = await getDecryptedApiKey(masterKey);
        if (storedKey) {
            setApiKey(storedKey);
            setApiKeySaved(true);
        }

        // Run Security Self-Check
        const storageCheck = await runStorageIntegrityCheck();
        const aiCheck = checkPrivacyFilterIntegrity();
        
        setHealth({
            keysSecure: storageCheck.keysFound,
            storageClean: storageCheck.leaks.length === 0,
            aiFilterActive: aiCheck,
            leaks: storageCheck.leaks,
            loading: false
        });
      } catch (error) {
        console.error("Failed to load settings:", error);
        setHealth(prev => ({ ...prev, loading: false }));
      }
    };
    loadSettings();
    
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, [masterKey]);

  const handleRequestNotifPermission = async () => {
    const permission = await requestPermission();
    setNotifPermission(permission);
  };

  const handleUpdateNotifPeriod = (period: number) => {
    setNotifPeriod(period);
    setNotificationPeriod(period);
    onNotifPeriodChange?.(period);
  };

  const handleSaveApiKey = async () => {
    // Encrypt the key using the Master Key before saving
    await saveEncryptedApiKey(apiKey, masterKey);
    setApiKeySaved(true);
    alert("API Key encrypted and saved to local device vault.");
  };
  
  const handleUpgradeToPro = async () => {
      await setProStatus(true);
      setIsPro(true);
      setShowUpgradeConfirm(false);
      alert("Pro features unlocked! (Simulated)");
  };

  const handleSetTheme = async (theme: AppTheme) => {
    setCurrentTheme(theme);
    await setThemeColor(theme);
    onThemeChange?.(theme);
  };

  const toggleBiometrics = async () => {
    if (isBiometricEnrolled) {
      await setBiometricEnrolled(false);
      setIsBiometricEnrolled(false);
    } else {
      // Trigger authentication overlay to enable
      setShowBioAuth(true);
    }
  };

  const handleBioAuthSuccess = async (masterKey: Uint8Array) => {
    try {
        const success = await enrollBiometricsWithKey(masterKey);
        if (success) {
            setIsBiometricEnrolled(true);
            alert(UI_STRINGS.security.bio_setup_success);
        } else {
            alert("Biometric enrollment failed.");
        }
    } catch (e: any) {
        alert("Failed to setup biometrics: " + e.message);
    } finally {
        setShowBioAuth(false);
    }
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (backupPassword.length < 4) {
      alert("Password must be at least 4 characters.");
      return;
    }

    setIsProcessingBackup(true);
    try {
      const blob = await exportEncryptedBackup(cards, backupPassword);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mycards_backup_${new Date().toISOString().split('T')[0]}.bin`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupMode(null);
      setBackupPassword('');
    } catch (err) {
      console.error(err);
      alert("Export failed.");
    } finally {
      setIsProcessingBackup(false);
    }
  };

  const handleImportClick = () => {
    // Explicitly click the hidden input when the div is clicked
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setRestoreFile(e.target.files[0]);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = restoreFile;
    if (!file || backupPassword.length < 1) return;

    setIsProcessingBackup(true);
    try {
      const buffer = await file.arrayBuffer();
      const payload = await importEncryptedBackup(buffer, backupPassword);
      
      // 1. Restore Cards
      await saveCards(payload.data, masterKey);
      
      // 2. Restore Settings
      if (payload.settings) {
        await restoreSettings(payload.settings);
        if (payload.settings.theme) {
            onThemeChange?.(payload.settings.theme);
        }
      }
      
      onCardsSynced(payload.data);
      
      alert("Backup restored successfully. The app will now reload.");
      
      // 3. Force Reload
      window.location.reload();
      
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Import failed. Check password or file.");
    } finally {
      setIsProcessingBackup(false);
    }
  };

  // --- Theme Spectrum Logic ---
  const themes = useMemo(() => Object.keys(THEME_PALETTES) as AppTheme[], []);
  
  // Calculate slider background gradient
  const spectrumGradient = useMemo(() => {
    const stops = themes.map(t => {
      const rgb = THEME_PALETTES[t].primary[500].split(' ').join(',');
      return `rgb(${rgb})`;
    }).join(', ');
    return `linear-gradient(to right, ${stops})`;
  }, [themes]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    const selectedTheme = themes[index];
    if (selectedTheme) {
      handleSetTheme(selectedTheme);
    }
  };

  if (showMpinReset) {
    return (
      <SecurityAuth 
        mode="reset" 
        onSuccess={() => setShowMpinReset(false)} 
        onCancel={() => setShowMpinReset(false)}
      />
    );
  }

  if (showPrivacyScreen) {
    return <PrivacyScreen onContinue={() => setShowPrivacyScreen(false)} />;
  }

  if (showBioAuth) {
    return (
        <div className="fixed inset-0 z-[100]">
            <SecurityAuth 
                mode="verify"
                onSuccess={handleBioAuthSuccess}
                onCancel={() => setShowBioAuth(false)}
            />
        </div>
    );
  }

  // Upgrade Modal
  if (showUpgradeConfirm) {
    return (
      <div className="fixed inset-0 z-[90] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
        <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 shadow-2xl animate-in zoom-in duration-200 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/30">
                <Crown size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{UI_STRINGS.monetization.upgrade_title}</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 text-sm">{UI_STRINGS.monetization.upgrade_subtitle}</p>
            
            <div className="space-y-4 mb-8 text-left bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{UI_STRINGS.monetization.feat_advisor}</span>
                </div>
                <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{UI_STRINGS.monetization.feat_export}</span>
                </div>
                <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{UI_STRINGS.monetization.feat_alerts}</span>
                </div>
            </div>

            <div className="flex gap-3">
                <button onClick={() => setShowUpgradeConfirm(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500 font-black text-[10px] uppercase tracking-widest">{UI_STRINGS.common.cancel}</button>
                <button onClick={handleUpgradeToPro} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/30">{UI_STRINGS.monetization.upgrade_btn}</button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{UI_STRINGS.settings.title}</h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{UI_STRINGS.settings.subtitle}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={24} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

          {/* Pro Status */}
          <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-[2rem] shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                <Crown size={120} />
            </div>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isPro ? 'bg-yellow-400 text-yellow-900' : 'bg-white/10 text-slate-300'}`}>
                            {isPro ? <Crown size={20} /> : <Zap size={20} />}
                        </div>
                        <div>
                            <h3 className="text-lg font-black tracking-tight">{UI_STRINGS.monetization.plan_title}</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                                {isPro ? "Unlimited Lifetime Access" : "Standard Local Tier"}
                            </p>
                        </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isPro ? 'bg-yellow-400 text-yellow-900' : 'bg-slate-700 text-slate-300'}`}>
                        {isPro ? UI_STRINGS.monetization.pro_badge : UI_STRINGS.monetization.free_badge}
                    </span>
                </div>

                {!isPro && (
                    <div className="mb-6">
                         <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2 opacity-80">
                            <span>{UI_STRINGS.monetization.credits_used}</span>
                            <span>{advisorUsage.count} {UI_STRINGS.monetization.credits_limit}</span>
                         </div>
                         <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ${advisorUsage.count >= advisorUsage.limit ? 'bg-rose-500' : 'bg-blue-500'}`} 
                                style={{ width: `${Math.min(100, (advisorUsage.count / advisorUsage.limit) * 100)}%` }} 
                            />
                         </div>
                    </div>
                )}

                <div className="flex gap-3">
                    {!isPro ? (
                         <button 
                            onClick={() => setShowUpgradeConfirm(true)}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/30 transition-all active:scale-95"
                         >
                            {UI_STRINGS.monetization.upgrade_btn}
                         </button>
                    ) : (
                        <div className="flex-1 py-3 bg-white/10 rounded-xl text-center text-xs font-bold text-white/50 border border-white/5 select-none cursor-default">
                             {UI_STRINGS.monetization.pro_badge} Active
                        </div>
                    )}
                </div>
            </div>
          </div>

          {/* AI Configuration (API Key) */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">{UI_STRINGS.settings.ai_config_title}</h3>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                    <Key size={18} className="text-slate-400" />
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{UI_STRINGS.settings.api_key_label}</label>
                </div>
                <div className="relative mb-3">
                    <input 
                        type={isApiKeyVisible ? "text" : "password"} 
                        value={apiKey} 
                        onChange={(e) => { setApiKey(e.target.value); setApiKeySaved(false); }} 
                        placeholder={UI_STRINGS.settings.api_key_placeholder}
                        className="w-full pl-4 pr-12 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button 
                        onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        {isApiKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-[10px] text-slate-400 font-medium max-w-[60%]">{UI_STRINGS.settings.api_key_help}</p>
                    <button 
                        onClick={handleSaveApiKey}
                        disabled={apiKeySaved || !apiKey}
                        className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${apiKeySaved ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'}`}
                    >
                        {apiKeySaved ? "Saved" : "Save Key"}
                    </button>
                </div>
            </div>
          </section>

          {/* Customization (Theme) */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Appearance</h3>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Palette size={18} className="text-slate-400" />
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">App Theme</label>
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500" style={{ color: `var(--color-primary-500)` }}>{currentTheme}</span>
                </div>
                <div className="relative h-12 flex items-center">
                     <div className="absolute inset-x-0 h-4 rounded-full" style={{ background: spectrumGradient }} />
                     <input 
                        type="range" 
                        min="0" 
                        max={themes.length - 1} 
                        step="1"
                        value={themes.indexOf(currentTheme)}
                        onChange={handleSliderChange}
                        className="relative z-10 w-full opacity-0 cursor-pointer h-full"
                     />
                     <div 
                        className="absolute h-8 w-8 bg-white border-4 border-white shadow-lg rounded-full pointer-events-none transition-all duration-300"
                        style={{ 
                            left: `${(themes.indexOf(currentTheme) / (themes.length - 1)) * 100}%`,
                            backgroundColor: `var(--color-primary-500)`,
                            transform: 'translateX(-50%)'
                        }}
                     />
                </div>
                <div className="flex justify-between mt-2">
                    {themes.filter((_, i) => i % 4 === 0).map(t => (
                        <div key={t} className="w-1 h-1 bg-slate-300 rounded-full" />
                    ))}
                </div>
            </div>
          </section>

          {/* Notifications */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">{UI_STRINGS.settings.alerts_label}</h3>
            
            {/* Permission Check */}
            {notifPermission !== 'granted' && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Bell size={18} className="text-amber-500" />
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Enable notifications for alerts</span>
                    </div>
                    <button onClick={handleRequestNotifPermission} className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-widest">{UI_STRINGS.settings.grant_permission_btn}</button>
                </div>
            )}

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{UI_STRINGS.settings.expiry_warning_title}</h4>
                    <p className="text-xs text-slate-500 font-medium">{UI_STRINGS.settings.expiry_warning_hint}</p>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    {[1, 2, 3].map(m => (
                        <button 
                            key={m}
                            onClick={() => handleUpdateNotifPeriod(m)}
                            className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${notifPeriod === m ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {m}M
                        </button>
                    ))}
                </div>
            </div>
          </section>

          {/* Security */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">{UI_STRINGS.settings.security_label}</h3>
            
            <button 
                onClick={toggleBiometrics}
                className="w-full p-5 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 flex items-center justify-between group hover:border-blue-500 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${isBiometricEnrolled ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                        <Fingerprint size={20} />
                    </div>
                    <div className="text-left">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{UI_STRINGS.settings.bio_login_title}</h4>
                        <p className="text-xs text-slate-500 font-medium">{isBiometricEnrolled ? "Enabled" : "Disabled"}</p>
                    </div>
                </div>
                <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isBiometricEnrolled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isBiometricEnrolled ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
            </button>

            <button 
                onClick={() => setShowMpinReset(true)}
                className="w-full p-5 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 flex items-center justify-between group hover:border-blue-500 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl">
                        <RefreshCcw size={20} />
                    </div>
                    <div className="text-left">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{UI_STRINGS.settings.update_mpin_title}</h4>
                        <p className="text-xs text-slate-500 font-medium">{UI_STRINGS.settings.update_mpin_hint}</p>
                    </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                    <ExternalLink size={14} />
                </div>
            </button>

             <button 
                onClick={() => setShowPrivacyScreen(true)}
                className="w-full p-5 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 flex items-center justify-between group hover:border-blue-500 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl">
                        <ShieldCheck size={20} />
                    </div>
                    <div className="text-left">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{UI_STRINGS.settings.privacy_btn}</h4>
                        <p className="text-xs text-slate-500 font-medium">{UI_STRINGS.settings.privacy_hint}</p>
                    </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                    <ExternalLink size={14} />
                </div>
            </button>
          </section>

          {/* Backup */}
          <section className="space-y-4">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">{UI_STRINGS.settings.backup_section_title}</h3>
             
             {backupMode === null ? (
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => setBackupMode('export')}
                        className="p-5 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                            <Download size={24} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{UI_STRINGS.settings.export_btn}</span>
                    </button>
                    <button 
                         onClick={() => setBackupMode('import')}
                         className="p-5 bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-xl">
                            <Upload size={24} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{UI_STRINGS.settings.import_btn}</span>
                    </button>
                </div>
             ) : (
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-300">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-black uppercase tracking-widest">{backupMode === 'export' ? UI_STRINGS.settings.export_modal_title : UI_STRINGS.settings.import_modal_title}</h4>
                        <button onClick={() => { setBackupMode(null); setRestoreFile(null); setBackupPassword(''); }} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"><X size={16} /></button>
                    </div>

                    <form onSubmit={backupMode === 'export' ? handleExport : handleImport} className="space-y-4">
                        {backupMode === 'import' && (
                            <div 
                                onClick={handleImportClick}
                                className={`w-full p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors ${restoreFile ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 dark:border-slate-600 hover:border-blue-500'}`}
                            >
                                <input ref={fileInputRef} type="file" accept=".bin" onChange={handleFileChange} className="hidden" />
                                {restoreFile ? (
                                    <>
                                        <FileLock size={32} className="text-emerald-500 mb-2" />
                                        <span className="text-xs font-bold text-emerald-600">{restoreFile.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={32} className="text-slate-400 mb-2" />
                                        <span className="text-xs font-bold text-slate-500">Tap to select backup file</span>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{UI_STRINGS.settings.password_label}</label>
                             <div className="relative">
                                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="password" 
                                    value={backupPassword}
                                    onChange={e => setBackupPassword(e.target.value)}
                                    placeholder={backupMode === 'export' ? "Create a password" : "Enter backup password"}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                             </div>
                             <p className="text-[10px] text-slate-500 font-medium px-2">{backupMode === 'export' ? UI_STRINGS.settings.password_hint : UI_STRINGS.settings.import_password_hint}</p>
                        </div>

                        {backupMode === 'import' && (
                             <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-500 rounded-xl text-[10px] font-bold border border-amber-100 dark:border-amber-900/30">
                                <AlertTriangle size={14} className="shrink-0" />
                                {UI_STRINGS.settings.import_warning}
                             </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isProcessingBackup}
                            className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest text-white transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${backupMode === 'export' ? 'bg-blue-600 shadow-blue-500/30' : 'bg-purple-600 shadow-purple-500/30'}`}
                        >
                            {isProcessingBackup && <Loader2 size={14} className="animate-spin" />}
                            <span>{backupMode === 'export' ? UI_STRINGS.settings.export_action : UI_STRINGS.settings.import_action}</span>
                        </button>
                    </form>
                </div>
             )}
          </section>

          {/* Danger Zone */}
          <section className="space-y-4">
             <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] px-2">{UI_STRINGS.settings.danger_zone_label}</h3>
             
             {!showWipeConfirm ? (
                 <button 
                    onClick={() => setShowWipeConfirm(true)}
                    className="w-full p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-[2rem] text-rose-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-colors"
                 >
                    <Trash2 size={16} />
                    <span>{UI_STRINGS.settings.wipe_vault_btn}</span>
                 </button>
             ) : (
                <div className="p-6 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 rounded-[2rem] text-center space-y-4 animate-in fade-in zoom-in">
                    <ShieldAlert size={32} className="text-rose-500 mx-auto" />
                    <div>
                        <h4 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">{UI_STRINGS.settings.wipe_confirm_text}</h4>
                        <p className="text-xs text-rose-500 mt-1">This action cannot be undone.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setShowWipeConfirm(false)} className="flex-1 py-3 bg-white dark:bg-slate-800 rounded-xl text-slate-500 font-bold text-xs uppercase tracking-widest">{UI_STRINGS.common.cancel}</button>
                        <button onClick={() => wipeEverything()} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-500/30">{UI_STRINGS.common.confirm}</button>
                    </div>
                </div>
             )}
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${health.keysSecure ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Integrity: {health.keysSecure ? "Secure" : "At Risk"}</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400">
                {UI_STRINGS.common.app_name} v{APP_VERSION} • {isPro ? "Pro Edition" : "Core Edition"}
            </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
