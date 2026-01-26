
import { Fingerprint, RefreshCcw, ShieldAlert, Trash2, X, Shield, Smartphone, Bell, BellRing, BellPlus, BellOff, ShieldCheck, Download, Upload, FileLock, Check, Activity, Lock } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { CreditCard } from '../types';
import { 
  getBiometricEnrolled, 
  setBiometricEnrolled, 
  wipeEverything, 
  getNotificationPeriod,
  setNotificationPeriod,
  enrollBiometrics,
  exportEncryptedBackup,
  importEncryptedBackup,
  saveCards,
  runStorageIntegrityCheck
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

  // Backup States
  const [backupMode, setBackupMode] = useState<'export' | 'import' | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [isProcessingBackup, setIsProcessingBackup] = useState(false);
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
  }, []);

  const handleRequestNotifPermission = async () => {
    const permission = await requestPermission();
    setNotifPermission(permission);
  };

  const handleUpdateNotifPeriod = (period: number) => {
    setNotifPeriod(period);
    setNotificationPeriod(period);
    onNotifPeriodChange?.(period);
  };

  const toggleBiometrics = async () => {
    if (isBiometricEnrolled) {
      await setBiometricEnrolled(false);
      setIsBiometricEnrolled(false);
    } else {
      const mpin = prompt("Enter your MPIN to authorize FaceID/TouchID:");
      if (mpin) {
        const success = await enrollBiometrics(mpin);
        if (success) {
          setIsBiometricEnrolled(true);
        } else {
          alert("Biometric enrollment failed. Ensure your device supports it.");
        }
      }
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
      setBackupMode('import');
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file || backupPassword.length < 1) return;

    setIsProcessingBackup(true);
    try {
      const buffer = await file.arrayBuffer();
      const restoredCards = await importEncryptedBackup(buffer, backupPassword);
      
      // Save directly to encrypted storage
      await saveCards(restoredCards, masterKey);
      onCardsSynced(restoredCards);
      
      alert(`Successfully restored ${restoredCards.length} cards.`);
      setBackupMode(null);
      setBackupPassword('');
      onClose(); // Close modal to refresh view context if needed
    } catch (err: any) {
      console.error(err);
      alert("Import failed: " + err.message);
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

  // Backup Modal Overlay
  if (backupMode) {
    return (
        <div className="fixed inset-0 z-[80] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 shadow-2xl animate-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                        {backupMode === 'export' ? UI_STRINGS.settings.export_modal_title : UI_STRINGS.settings.import_modal_title}
                    </h3>
                    <button onClick={() => { setBackupMode(null); setBackupPassword(''); }} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500"><X size={20} /></button>
                </div>
                
                <form onSubmit={backupMode === 'export' ? handleExport : handleImport} className="space-y-4">
                    {backupMode === 'import' && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800 flex items-start gap-3">
                            <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{UI_STRINGS.settings.import_warning}</p>
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
                        disabled={isProcessingBackup || !backupPassword}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isProcessingBackup ? UI_STRINGS.common.loading : (
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
                <button onClick={handleImportClick} className="p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
