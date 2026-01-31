import { Fingerprint, RefreshCcw, ShieldAlert, Trash2, X, Shield, Smartphone, Bell, BellRing, BellPlus, BellOff, ShieldCheck, Download, Upload, FileLock, Check, Activity, Lock, Key, Eye, EyeOff, ExternalLink, Zap, Crown, FileText, Loader2, Palette, AlertTriangle } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { CreditCard, AppTheme } from '../types';
import { 
  getBiometricEnrolled, 
  setBiometricEnrolled, 
  wipeEverything, 
  getNotificationPeriod,
  setNotificationPeriod,
  enrollBiometrics,
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
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">{UI_STRINGS.monetization.upgrade_subtitle}</p>
            
            <div className="space-y-3 mb-8 text-left">
                <div className="flex items-center gap-3">
                    <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-emerald-600"><Check size={12} /></div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{UI_STRINGS.monetization.feat_advisor}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-emerald-600"><Check size={12} /></div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{UI_STRINGS.monetization.feat_export}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full text-emerald-600"><Check size={12} /></div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{UI_STRINGS.monetization.feat_alerts}</span>
                </div>
            </div>

            <div className="flex gap-3">
                <button onClick={() => setShowUpgradeConfirm(false)} className="flex-1 py-4 text-slate-500 font-black text-xs uppercase tracking-widest hover:text-slate-700 dark:hover:text-slate-300">{UI_STRINGS.common.cancel}</button>
                <button onClick={handleUpgradeToPro} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/30 active:scale-95 transition-all">{UI_STRINGS.monetization.upgrade_btn}</button>
            </div>
        </div>
      </div>
    );
  }

  // Main Render
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl h-[85vh] rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in duration-300">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
            <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{UI_STRINGS.settings.title}</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{UI_STRINGS.settings.subtitle}</p>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <X size={20} className="text-slate-500" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">
            
            {/* Identity & Pro Status */}
            <section>
                <div className="flex items-center justify-between p-6 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-[2rem] text-white shadow-xl">
                   <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                         {isPro ? <Crown size={24} className="text-yellow-400" /> : <Smartphone size={24} />}
                      </div>
                      <div>
                         <h3 className="font-black text-lg leading-none mb-1">{isPro ? "Pro Member" : "Free Plan"}</h3>
                         <p className="text-xs text-slate-400 font-medium">{isPro ? "All features unlocked" : "Basic vault features"}</p>
                      </div>
                   </div>
                   {!isPro && (
                       <button onClick={() => setShowUpgradeConfirm(true)} className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/30 transition-all active:scale-95">
                          Upgrade
                       </button>
                   )}
                </div>
            </section>

             {/* API Key Configuration */}
             <section className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <Zap size={16} className="text-amber-500" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{UI_STRINGS.settings.ai_config_title}</h3>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-700 space-y-4">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                        {UI_STRINGS.settings.api_key_label}
                    </label>
                    <div className="flex gap-2">
                        <div className="relative flex-grow">
                             <input 
                                type={isApiKeyVisible ? "text" : "password"} 
                                value={apiKey}
                                onChange={(e) => { setApiKey(e.target.value); setApiKeySaved(false); }}
                                placeholder={UI_STRINGS.settings.api_key_placeholder}
                                className="w-full pl-5 pr-12 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                             />
                             <button 
                                onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                             >
                                {isApiKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                             </button>
                        </div>
                        <button 
                            onClick={handleSaveApiKey}
                            disabled={!apiKey || apiKeySaved}
                            className={`px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${apiKeySaved ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-600 text-white shadow-lg'}`}
                        >
                            {apiKeySaved ? "Saved" : "Save"}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                        <Lock size={10} />
                        {UI_STRINGS.settings.api_key_help}
                    </p>
                </div>
            </section>

            {/* Notifications */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <Bell size={16} className="text-blue-500" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{UI_STRINGS.settings.alerts_label}</h3>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                             <h4 className="font-bold text-slate-900 dark:text-white">{UI_STRINGS.settings.expiry_warning_title}</h4>
                             <p className="text-xs text-slate-500 dark:text-slate-400">{UI_STRINGS.settings.expiry_warning_hint}</p>
                        </div>
                        {notifPermission !== 'granted' && (
                            <button onClick={handleRequestNotifPermission} className="px-4 py-2 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                                {UI_STRINGS.settings.grant_permission_btn}
                            </button>
                        )}
                    </div>
                    
                    <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        {[1, 2, 3].map(m => (
                            <button 
                                key={m}
                                onClick={() => handleUpdateNotifPeriod(m)}
                                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${notifPeriod === m ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            >
                                {m} Month{m > 1 ? 's' : ''}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Theme */}
            <section className="space-y-4">
                 <div className="flex items-center gap-2 px-2">
                    <Palette size={16} className="text-purple-500" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">App Theme</h3>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-700">
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                         {(Object.keys(THEME_PALETTES) as AppTheme[]).map(theme => (
                             <button
                                key={theme}
                                onClick={() => handleSetTheme(theme)}
                                className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all ${currentTheme === theme ? 'border-slate-900 dark:border-white bg-white dark:bg-slate-800 shadow-lg scale-105' : 'border-transparent hover:bg-white dark:hover:bg-slate-800'}`}
                             >
                                 <div className={`w-6 h-6 rounded-full bg-${theme.toLowerCase()}-500 shadow-sm`} style={{ backgroundColor: `rgb(${THEME_PALETTES[theme].primary[500].split(' ').join(',')})` }} />
                                 <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{theme}</span>
                             </button>
                         ))}
                    </div>
                </div>
            </section>

            {/* Data Management */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <FileLock size={16} className="text-emerald-500" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{UI_STRINGS.settings.backup_section_title}</h3>
                </div>
                
                {!backupMode ? (
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setBackupMode('export')} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all group text-left">
                            <Download size={24} className="text-slate-400 group-hover:text-blue-500 mb-4 transition-colors" />
                            <h4 className="font-bold text-slate-700 dark:text-slate-200">{UI_STRINGS.settings.export_btn}</h4>
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">{UI_STRINGS.settings.backup_hint}</p>
                        </button>
                        <button onClick={() => setBackupMode('import')} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all group text-left">
                            <Upload size={24} className="text-slate-400 group-hover:text-emerald-500 mb-4 transition-colors" />
                            <h4 className="font-bold text-slate-700 dark:text-slate-200">{UI_STRINGS.settings.import_btn}</h4>
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">Restore .bin file</p>
                        </button>
                    </div>
                ) : (
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-900 dark:text-white">{backupMode === 'export' ? UI_STRINGS.settings.export_modal_title : UI_STRINGS.settings.import_modal_title}</h4>
                            <button onClick={() => { setBackupMode(null); setRestoreFile(null); setBackupPassword(''); }} className="text-xs font-bold text-slate-400 hover:text-slate-600">{UI_STRINGS.common.cancel}</button>
                        </div>
                        
                        <form onSubmit={backupMode === 'export' ? handleExport : handleImport} className="space-y-4">
                             {backupMode === 'import' && (
                                 <div 
                                    onClick={handleImportClick}
                                    className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-8 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                 >
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".bin" className="hidden" />
                                    {restoreFile ? (
                                        <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
                                            <FileText size={20} />
                                            <span className="font-bold text-sm truncate max-w-[200px]">{restoreFile.name}</span>
                                        </div>
                                    ) : (
                                        <div className="text-slate-400">
                                            <Upload size={24} className="mx-auto mb-2" />
                                            <p className="text-xs font-bold uppercase tracking-widest">Select Backup File</p>
                                        </div>
                                    )}
                                 </div>
                             )}

                             <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">{UI_STRINGS.settings.password_label}</label>
                                <input 
                                    type="password" 
                                    placeholder={backupMode === 'export' ? "Create a password" : "Enter backup password"}
                                    value={backupPassword}
                                    onChange={e => setBackupPassword(e.target.value)}
                                    className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                    required
                                />
                                <p className="text-[10px] text-slate-400 mt-2">{backupMode === 'export' ? UI_STRINGS.settings.password_hint : UI_STRINGS.settings.import_password_hint}</p>
                             </div>

                             {backupMode === 'import' && (
                                 <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-start gap-2">
                                     <AlertTriangle size={14} className="text-amber-600 mt-0.5" />
                                     <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-tight">{UI_STRINGS.settings.import_warning}</p>
                                 </div>
                             )}

                             <button 
                                type="submit" 
                                disabled={isProcessingBackup || (backupMode === 'import' && !restoreFile)}
                                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                             >
                                {isProcessingBackup ? <Loader2 size={16} className="animate-spin" /> : (backupMode === 'export' ? <Download size={16} /> : <RefreshCcw size={16} />)}
                                <span>{backupMode === 'export' ? UI_STRINGS.settings.export_action : UI_STRINGS.settings.import_action}</span>
                             </button>
                        </form>
                    </div>
                )}
            </section>

            {/* Security */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <ShieldCheck size={16} className="text-slate-400" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{UI_STRINGS.settings.security_label}</h3>
                </div>
                <div className="p-1 space-y-2">
                    <button onClick={toggleBiometrics} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between group hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white dark:bg-slate-900 rounded-xl text-slate-500 group-hover:text-blue-500 transition-colors"><Fingerprint size={20} /></div>
                            <div className="text-left">
                                <p className="font-bold text-slate-900 dark:text-white text-sm">{UI_STRINGS.settings.bio_login_title}</p>
                                <p className="text-[10px] text-slate-500 font-medium">{isBiometricEnrolled ? "Enabled" : "Disabled"}</p>
                            </div>
                        </div>
                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${isBiometricEnrolled ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isBiometricEnrolled ? 'translate-x-4' : ''}`} />
                        </div>
                    </button>

                    <button onClick={() => setShowMpinReset(true)} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between group hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white dark:bg-slate-900 rounded-xl text-slate-500 group-hover:text-blue-500 transition-colors"><Key size={20} /></div>
                            <div className="text-left">
                                <p className="font-bold text-slate-900 dark:text-white text-sm">{UI_STRINGS.settings.update_mpin_title}</p>
                                <p className="text-[10px] text-slate-500 font-medium">{UI_STRINGS.settings.update_mpin_hint}</p>
                            </div>
                        </div>
                        <RefreshCcw size={16} className="text-slate-400" />
                    </button>

                    <button onClick={() => setShowPrivacyScreen(true)} className="w-full p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between group hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white dark:bg-slate-900 rounded-xl text-slate-500 group-hover:text-blue-500 transition-colors"><Shield size={20} /></div>
                            <div className="text-left">
                                <p className="font-bold text-slate-900 dark:text-white text-sm">{UI_STRINGS.settings.privacy_btn}</p>
                                <p className="text-[10px] text-slate-500 font-medium">{UI_STRINGS.settings.privacy_hint}</p>
                            </div>
                        </div>
                        <ExternalLink size={16} className="text-slate-400" />
                    </button>
                </div>
            </section>

             {/* System Health */}
             <section className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <Activity size={16} className="text-slate-400" />
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{UI_STRINGS.settings.health_title}</h3>
                </div>
                {health.loading ? (
                    <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" /></div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 text-center ${health.keysSecure ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-rose-50 border-rose-100'}`}>
                            {health.keysSecure ? <CheckCircle2 size={20} className="text-emerald-500" /> : <ShieldAlert size={20} className="text-rose-500" />}
                            <span className="text-[10px] font-black uppercase text-slate-500">{UI_STRINGS.settings.health_enc}</span>
                        </div>
                        <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 text-center ${health.storageClean ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-rose-50 border-rose-100'}`}>
                            {health.storageClean ? <CheckCircle2 size={20} className="text-emerald-500" /> : <ShieldAlert size={20} className="text-rose-500" />}
                            <span className="text-[10px] font-black uppercase text-slate-500">{UI_STRINGS.settings.health_storage}</span>
                        </div>
                        <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 text-center ${health.aiFilterActive ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30' : 'bg-amber-50 border-amber-100'}`}>
                            {health.aiFilterActive ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertTriangle size={20} className="text-amber-500" />}
                            <span className="text-[10px] font-black uppercase text-slate-500">{UI_STRINGS.settings.health_ai}</span>
                        </div>
                    </div>
                )}
                {health.leaks.length > 0 && (
                    <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-xs font-medium border border-rose-100">
                        {UI_STRINGS.settings.health_leaks} {health.leaks.join(', ')}
                    </div>
                )}
            </section>

             {/* Danger Zone */}
            <section className="pt-8">
                 {!showWipeConfirm ? (
                     <button onClick={() => setShowWipeConfirm(true)} className="w-full p-4 rounded-2xl border-2 border-rose-100 dark:border-rose-900/30 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest">
                         <Trash2 size={16} />
                         <span>{UI_STRINGS.settings.wipe_vault_btn}</span>
                     </button>
                 ) : (
                     <div className="p-6 bg-rose-50 dark:bg-rose-900/10 rounded-[2rem] border-2 border-rose-100 dark:border-rose-900/30 text-center animate-in zoom-in">
                         <h4 className="text-rose-600 dark:text-rose-400 font-black mb-4">{UI_STRINGS.settings.wipe_confirm_text}</h4>
                         <div className="flex gap-3">
                             <button onClick={() => setShowWipeConfirm(false)} className="flex-1 py-3 bg-white dark:bg-slate-900 rounded-xl font-bold text-slate-500 text-xs uppercase tracking-widest">{UI_STRINGS.common.cancel}</button>
                             <button onClick={() => { wipeEverything(); onClose(); }} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-rose-500/30">{UI_STRINGS.common.delete}</button>
                         </div>
                     </div>
                 )}
                 <p className="text-center text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest mt-6">Version {APP_VERSION}</p>
            </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;