

import { Fingerprint, RefreshCcw, ShieldAlert, Trash2, X, Shield, Smartphone, Bell, BellRing, BellPlus, BellOff, ShieldCheck, Download, Upload, FileLock, Check, Activity, Lock, Key, Eye, EyeOff, ExternalLink, Zap, Crown, FileText, Loader2 } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { CreditCard } from '../types';
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
  restoreSettings
} from '../utils/storage';
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
}

const SettingsModal: React.FC<SettingsModalProps> = ({ cards, onClose, masterKey, onNotifPeriodChange, onCardsSynced }) => {
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);
  const [notifPeriod, setNotifPeriod] = useState(2);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [showMpinReset, setShowMpinReset] = useState(false);
  const [showPrivacyScreen, setShowPrivacyScreen] = useState(false);
  const [showBioAuth, setShowBioAuth] = useState(false);
  
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
    fileInputRef.current?.click();
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
            <p className="text-sm font-medium text-slate-500 mb-8">{UI_STRINGS.monetization.upgrade_subtitle}</p>
            
            <div className="space-y-4 text-left mb-8">
                {[
                   UI_STRINGS.monetization.feat_advisor,
                   UI_STRINGS.monetization.feat_export,
                   UI_STRINGS.monetization.feat_alerts,
                   UI_STRINGS.monetization.feat_support
                ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <Check className="text-emerald-500 shrink-0" size={16} />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{feat}</span>
                    </div>
                ))}
            </div>

            <button 
                onClick={handleUpgradeToPro}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/30 active:scale-95 transition-all mb-3"
            >
                {UI_STRINGS.monetization.upgrade_btn}
            </button>
            <button 
                onClick={() => setShowUpgradeConfirm(false)}
                className="w-full py-3 text-slate-400 font-bold text-xs"
            >
                {UI_STRINGS.common.cancel}
            </button>
        </div>
      </div>
    );
  }

  // Backup Modal Overlay
  if (backupMode) {
    return (
        <div className="fixed inset-0 z-[80] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 shadow-2xl animate-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                        {backupMode === 'export' ? UI_STRINGS.settings.export_modal_title : UI_STRINGS.settings.import_modal_title}
                    </h3>
                    <button onClick={() => { setBackupMode(null); setBackupPassword(''); setRestoreFile(null); }} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500"><X size={20} /></button>
                </div>
                
                <form onSubmit={backupMode === 'export' ? handleExport : handleImport} className="space-y-4">
                    {backupMode === 'import' && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800 flex items-start gap-3">
                            <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{UI_STRINGS.settings.import_warning}</p>
                        </div>
                    )}
                    
                    {backupMode === 'import' && (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Backup File</label>
                        <div 
                          onClick={handleImportClick}
                          className={`p-4 rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 cursor-pointer transition-all active:scale-95 ${restoreFile ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}
                        >
                           {restoreFile ? (
                             <>
                               <FileText size={20} className="text-emerald-500" />
                               <span className="text-xs font-bold text-emerald-600 truncate max-w-[200px]">{restoreFile.name}</span>
                             </>
                           ) : (
                             <>
                               <Upload size={20} className="text-slate-400" />
                               <span className="text-xs font-bold text-slate-500">Select .bin file</span>
                             </>
                           )}
                        </div>
                      </div>
                    )}
                    
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{UI_STRINGS.settings.password_label}</label>
                        <input 
                            type="password" 
                            autoFocus
                            value={backupPassword}
                            onChange={e => setBackupPassword(e.target.value)}
                            placeholder="***"
                            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white"
                        />
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">
                            {backupMode === 'export' ? UI_STRINGS.settings.password_hint : UI_STRINGS.settings.import_password_hint}
                        </p>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isProcessingBackup || !backupPassword || (backupMode === 'import' && !restoreFile)}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                    >
                        {isProcessingBackup ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>{backupMode === 'import' ? "Restoring..." : UI_STRINGS.common.loading}</span>
                          </>
                        ) : (
                            backupMode === 'export' ? UI_STRINGS.settings.export_action : UI_STRINGS.settings.import_action
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xl flex flex-col items-center overflow-y-auto custom-scrollbar pt-10 pb-20 px-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in zoom-in fade-in duration-300 border border-white/10 flex flex-col mb-10">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
          <div className="text-left">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Vault Controls</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest mt-1">Profile & Security</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={24} className="text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <div className="p-8 space-y-8 text-left">
          
          {/* Plan Membership Section */}
          <div className="space-y-4">
             <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{UI_STRINGS.monetization.plan_title}</label>
             <div className={`p-6 rounded-[2rem] border relative overflow-hidden ${isPro ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                {isPro && <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />}
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                   <div>
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest mb-2 ${isPro ? 'bg-white text-indigo-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                         {isPro ? <Crown size={12} fill="currentColor" /> : <div className="w-2 h-2 rounded-full bg-slate-400" />}
                         <span>{isPro ? UI_STRINGS.monetization.pro_badge : UI_STRINGS.monetization.free_badge}</span>
                      </div>
                      <h4 className={`text-xl font-black ${isPro ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {isPro ? 'Pro Membership' : 'Standard Access'}
                      </h4>
                   </div>
                   {!isPro && (
                       <button 
                         onClick={() => setShowUpgradeConfirm(true)}
                         className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                       >
                         {UI_STRINGS.monetization.upgrade_btn}
                       </button>
                   )}
                </div>

                {!isPro && (
                   <div className="relative z-10">
                      <div className="flex justify-between items-end mb-2">
                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{UI_STRINGS.monetization.credits_used}</span>
                         <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {advisorUsage.count} <span className="text-slate-400">{UI_STRINGS.monetization.credits_limit}</span>
                         </span>
                      </div>
                      <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                         <div className={`h-full rounded-full transition-all duration-500 ${advisorUsage.count >= advisorUsage.limit ? 'bg-rose-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (advisorUsage.count / advisorUsage.limit) * 100)}%` }} />
                      </div>
                   </div>
                )}
                
                {isPro && (
                    <div className="relative z-10 text-indigo-100 text-xs font-medium">
                       <p>Thank you for supporting independent development. Your vault is fully unlocked.</p>
                    </div>
                )}
             </div>
          </div>

          {/* AI Configuration */}
          <div className="space-y-4">
             <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{UI_STRINGS.settings.ai_config_title}</label>
             <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-[2rem] space-y-4">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center"><Key size={20} /></div>
                    <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">{UI_STRINGS.settings.api_key_label}</p>
                        <p className="text-[10px] text-slate-500 font-bold">{UI_STRINGS.settings.api_key_help}</p>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] font-black text-blue-500 hover:underline mt-1">
                            <span>Get API Key</span>
                            <ExternalLink size={10} />
                        </a>
                    </div>
                </div>
                <div className="relative">
                    <input 
                        type={isApiKeyVisible ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => { setApiKey(e.target.value); setApiKeySaved(false); }}
                        placeholder={UI_STRINGS.settings.api_key_placeholder}
                        className="w-full pl-5 pr-12 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-600 focus:border-blue-500 outline-none font-mono text-sm dark:text-white transition-all"
                    />
                    <button 
                        onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-blue-500 transition-colors"
                    >
                        {isApiKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <button 
                    onClick={handleSaveApiKey}
                    disabled={apiKeySaved || !apiKey}
                    className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${apiKeySaved ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20'}`}
                >
                    {apiKeySaved ? UI_STRINGS.common.save_success : UI_STRINGS.common.save}
                </button>
             </div>
          </div>

          {/* System Health Check */}
          <div className="space-y-4">
             <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{UI_STRINGS.settings.health_title}</label>
             <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-[2rem] space-y-4">
                {!health.loading && (
                    <>
                        {/* Encryption Status */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Lock size={16} className={health.keysSecure ? 'text-slate-400' : 'text-rose-400'} />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{UI_STRINGS.settings.health_enc}</span>
                            </div>
                            <div className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${health.keysSecure ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {health.keysSecure ? 'SECURE' : 'ERROR'}
                            </div>
                        </div>
                        
                        {/* Storage Status */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <FileLock size={16} className={health.storageClean ? 'text-slate-400' : 'text-rose-400'} />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{UI_STRINGS.settings.health_storage}</span>
                            </div>
                            <div className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${health.storageClean ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {health.storageClean ? 'CLEAN' : 'LEAK DETECTED'}
                            </div>
                        </div>
                        
                        {/* AI Status */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Activity size={16} className={health.aiFilterActive ? 'text-slate-400' : 'text-rose-400'} />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{UI_STRINGS.settings.health_ai}</span>
                            </div>
                            <div className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${health.aiFilterActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {health.aiFilterActive ? 'ACTIVE' : 'FAILED'}
                            </div>
                        </div>

                        {!health.storageClean && (
                            <div className="pt-2 text-[10px] font-bold text-rose-500 leading-tight">
                                {UI_STRINGS.settings.health_leaks} {health.leaks.join(', ')}
                            </div>
                        )}
                    </>
                )}
             </div>
          </div>
          
          {/* Notification Settings */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Smart Alerts</label>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-[2rem] shadow-sm space-y-4">
              {notifPermission === 'default' && (
                 <button onClick={handleRequestNotifPermission} className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                    <BellPlus size={16} />
                    <span>Enable Expiry Notifications</span>
                 </button>
              )}
              {notifPermission === 'denied' && (
                 <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20">
                    <BellOff size={24} className="shrink-0" />
                    <span>Notifications blocked. Please enable them in your browser settings.</span>
                 </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center"><BellRing size={20} /></div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Expiry Warning</p>
                    <p className="text-[10px] text-slate-500 font-bold">Alert before deadline</p>
                  </div>
                </div>
                <span className="text-xl font-black text-blue-600 dark:text-blue-400">{notifPeriod}M</span>
              </div>
              
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
                {[1, 2, 3, 6].map((m) => (
                  <button key={m} onClick={() => handleUpdateNotifPeriod(m)} className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${notifPeriod === m ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}>{m}M</button>
                ))}
              </div>
            </div>
          </div>

          {/* Backup & Restore */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{UI_STRINGS.settings.backup_section_title}</label>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setBackupMode('export')} className="p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 flex items-center justify-center"><Download size={20} /></div>
                    <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">Export</span>
                </button>
                <button onClick={() => setBackupMode('import')} className="p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 flex items-center justify-center"><Upload size={20} /></div>
                    <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">Restore</span>
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".bin" 
                    onChange={handleFileChange}
                />
            </div>
          </div>

          {/* Device Security */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Device Security</label>
            <div className="space-y-3">
              <button onClick={() => setShowMpinReset(true)} className="w-full p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform"><RefreshCcw size={20} /></div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Update MPIN</p>
                    <p className="text-[10px] text-slate-500 font-bold">Recovery Word required</p>
                  </div>
                </div>
                <Smartphone size={16} className="text-slate-300" />
              </button>

              <div className="p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isBiometricEnrolled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}><Fingerprint size={20} /></div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Biometric Login</p>
                    <p className="text-[10px] text-slate-500 font-bold">FaceID / TouchID</p>
                  </div>
                </div>
                <button onClick={toggleBiometrics} className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${isBiometricEnrolled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isBiometricEnrolled ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>

              <button onClick={() => setShowPrivacyScreen(true)} className="w-full p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform"><ShieldCheck size={20} /></div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{UI_STRINGS.settings.privacy_btn}</p>
                    <p className="text-[10px] text-slate-500 font-bold">{UI_STRINGS.settings.privacy_hint}</p>
                  </div>
                </div>
                <Smartphone size={16} className="text-slate-300" />
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 pb-4 text-center">
            <label className="block text-[10px] font-black text-rose-400 dark:text-rose-500 uppercase tracking-[0.2em]">Danger Zone</label>
            {showWipeConfirm ? (
              <div className="p-5 bg-rose-50 dark:bg-rose-900/20 rounded-3xl border-2 border-rose-200 dark:border-rose-800 animate-in zoom-in duration-200">
                <div className="flex flex-col items-center gap-2 mb-4">
                    <ShieldAlert size={24} className="text-rose-600" />
                    <p className="text-xs text-rose-600 font-black">CRITICAL: This is irreversible.</p>
                    <p className="text-[10px] text-rose-500 font-bold">All encrypted records and keys will be destroyed.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowWipeConfirm(false)} className="flex-1 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest">Cancel</button>
                  <button onClick={() => wipeEverything()} className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-black text-xs uppercase tracking-widest">Delete All My Data</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowWipeConfirm(true)} className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-2xl font-black text-sm hover:bg-rose-100 transition-all border border-rose-100 dark:border-rose-900/30">
                <Trash2 size={18} /><span>Delete All My Data</span>
              </button>
            )}
          </div>
          
          {/* Privacy Notice Footer */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-400 mb-2">
              <Shield size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">{UI_STRINGS.privacy.notice_title}</span>
            </div>
            <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed">
              {UI_STRINGS.privacy.notice_text}
            </p>
             <div className="mt-4 inline-block px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
               v{APP_VERSION}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;