
import { Cloud, Database, Fingerprint, Loader2, LogIn, LogOut, Mail, RefreshCw, ShieldAlert, ShieldCheck, Trash2, X, Lock as LockIcon, Shield, Smartphone, Share, Plus, RefreshCcw, CheckCircle2, Bell, BellRing, User } from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { CreditCard } from '../types';
import { 
  getBiometricEnrolled, 
  getFromCloudMock, 
  getUser, 
  saveCards, 
  saveToCloudMock, 
  saveUser, 
  setBiometricEnrolled, 
  wipeEverything, 
  encryptAppDataForCloud, 
  decryptAppDataFromCloud,
  getNotificationPeriod,
  setNotificationPeriod,
  enrollBiometrics
} from '../utils/storage';
import SecurityAuth from './SecurityAuth';
import { UI_STRINGS } from '../locales/en';

interface SettingsModalProps {
  cards: CreditCard[];
  onCardsSynced: (newCards: CreditCard[]) => void;
  onClose: () => void;
  masterKey: Uint8Array;
  onNotifPeriodChange?: (months: number) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ cards, onCardsSynced, onClose, masterKey, onNotifPeriodChange }) => {
  const [user, setUser] = useState<{ name: string, email: string, picture?: string } | null>(getUser());
  const [isSyncing, setIsSyncing] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(getBiometricEnrolled());
  const [notifPeriod, setNotifPeriod] = useState(getNotificationPeriod());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [showMpinReset, setShowMpinReset] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!user && (window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.initialize({
        client_id: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
        callback: (response: any) => {
          const simulatedUser = {
            name: "Verified Account",
            email: "secure.user@gmail.com",
            picture: "https://lh3.googleusercontent.com/a/default-user=s120-c"
          };
          setUser(simulatedUser);
          saveUser(simulatedUser);
        }
      });
      if (googleBtnRef.current) {
        (window as any).google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          shape: "pill"
        });
      }
    }
  }, [user]);

  const handleLogout = () => { setUser(null); saveUser(null); };

  const handleSyncToCloud = async () => {
    if (!user || !masterKey) return;
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      const encryptedBlob = await encryptAppDataForCloud(cards, masterKey);
      saveToCloudMock(encryptedBlob);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err) {
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!user || !masterKey) return;
    setIsSyncing(true);
    try {
      const encryptedBlob = getFromCloudMock();
      if (!encryptedBlob) {
        alert("No cloud backup found for this account.");
        return;
      }
      
      const { cards: restoredCards } = await decryptAppDataFromCloud(encryptedBlob, masterKey);
      await saveCards(restoredCards, masterKey);
      onCardsSynced(restoredCards);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err) {
      alert(UI_STRINGS.settings.restore_failed);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateNotifPeriod = (period: number) => {
    setNotifPeriod(period);
    setNotificationPeriod(period);
    onNotifPeriodChange?.(period);
  };

  const requestNotifPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
    }
  };

  const toggleBiometrics = async () => {
    if (isBiometricEnrolled) {
      setBiometricEnrolled(false);
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

  if (showMpinReset) {
    return (
      <SecurityAuth 
        mode="reset" 
        onSuccess={() => setShowMpinReset(false)} 
        onCancel={() => setShowMpinReset(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xl flex flex-col items-center overflow-y-auto custom-scrollbar pt-10 pb-20 px-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl animate-in zoom-in fade-in duration-300 border border-white/10 flex flex-col mb-10">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
          <div className="text-left">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{UI_STRINGS.settings.title}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest mt-1">{UI_STRINGS.settings.subtitle}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={24} className="text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <div className="p-8 space-y-8 text-left">
          {/* Google Account */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{UI_STRINGS.settings.identity_label}</label>
            {user ? (
              <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 flex items-center gap-4 transition-all">
                <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg border-2 border-white dark:border-slate-600">
                  <img src={user.picture || `https://ui-avatars.com/api/?name=${user.name}&background=random`} alt="User" className="w-full h-full object-cover" />
                </div>
                <div className="flex-grow">
                  <p className="font-black text-slate-900 dark:text-white text-sm">{user.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-medium">{user.email}</p>
                </div>
                <button onClick={handleLogout} className="p-3 text-slate-400 hover:text-rose-500 transition-colors">
                    <LogOut size={18} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                 <div ref={googleBtnRef} className="w-full flex justify-center"></div>
                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center italic">{UI_STRINGS.settings.identity_hint}</p>
              </div>
            )}
          </div>

          {/* Sync & Backup */}
          <div className="space-y-4">
             <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{UI_STRINGS.settings.sync_label}</label>
             <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleSyncToCloud} 
                  disabled={!user || isSyncing} 
                  className="flex flex-col items-center gap-2 p-5 bg-blue-600 text-white rounded-3xl font-bold shadow-lg shadow-blue-500/20 disabled:opacity-40 transition-all active:scale-95"
                >
                  <Cloud size={24} />
                  <span className="text-xs font-black uppercase tracking-widest">{UI_STRINGS.settings.backup_btn}</span>
                </button>
                <button 
                  onClick={handleRestoreFromCloud} 
                  disabled={!user || isSyncing} 
                  className="flex flex-col items-center gap-2 p-5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-3xl font-bold disabled:opacity-40 transition-all active:scale-95"
                >
                  <RefreshCw size={24} className={isSyncing ? 'animate-spin' : ''} />
                  <span className="text-xs font-black uppercase tracking-widest">{UI_STRINGS.settings.restore_btn}</span>
                </button>
             </div>
             {syncStatus === 'success' && (
               <div className="flex items-center justify-center gap-2 text-emerald-500 font-bold text-xs animate-in slide-in-from-bottom-2">
                 <CheckCircle2 size={16} /><span>{UI_STRINGS.settings.sync_success}</span>
               </div>
             )}
          </div>

          {/* Notification Settings */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{UI_STRINGS.settings.alerts_label}</label>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-[2rem] shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center">
                    <BellRing size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{UI_STRINGS.settings.expiry_warning_title}</p>
                    <p className="text-[10px] text-slate-500 font-bold">{UI_STRINGS.settings.expiry_warning_hint}</p>
                  </div>
                </div>
                <span className="text-xl font-black text-blue-600 dark:text-blue-400">{notifPeriod}M</span>
              </div>
              
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
                {[1, 2, 3, 6].map((m) => (
                  <button
                    key={m}
                    onClick={() => handleUpdateNotifPeriod(m)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${notifPeriod === m ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    {m}M
                  </button>
                ))}
              </div>

              {notifPermission !== 'granted' && (
                <button 
                  onClick={requestNotifPermission}
                  className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <BellRing size={14} />
                  {UI_STRINGS.settings.grant_permission_btn}
                </button>
              )}
            </div>
          </div>

          {/* Security & Recovery */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{UI_STRINGS.settings.security_label}</label>
            <div className="space-y-3">
              <button 
                onClick={() => setShowMpinReset(true)}
                className="w-full p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform"><RefreshCcw size={20} /></div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{UI_STRINGS.settings.update_mpin_title}</p>
                    <p className="text-[10px] text-slate-500 font-bold">{UI_STRINGS.settings.update_mpin_hint}</p>
                  </div>
                </div>
                <Smartphone size={16} className="text-slate-300" />
              </button>

              <div className="p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isBiometricEnrolled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}><Fingerprint size={20} /></div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{UI_STRINGS.settings.bio_login_title}</p>
                    <p className="text-[10px] text-slate-500 font-bold">{UI_STRINGS.security.biometrics_subtitle}</p>
                  </div>
                </div>
                <button onClick={toggleBiometrics} className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${isBiometricEnrolled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isBiometricEnrolled ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 pb-4">
            <label className="block text-[10px] font-black text-rose-400 dark:text-rose-500 uppercase tracking-[0.2em]">{UI_STRINGS.settings.danger_zone_label}</label>
            {showWipeConfirm ? (
              <div className="p-5 bg-rose-50 dark:bg-rose-900/20 rounded-3xl border-2 border-rose-200 dark:border-rose-800 animate-in zoom-in duration-200">
                <p className="text-xs text-rose-600 mb-4 font-black text-center">{UI_STRINGS.settings.wipe_confirm_text}</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowWipeConfirm(false)} className="flex-1 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest">{UI_STRINGS.common.cancel}</button>
                  <button onClick={() => wipeEverything()} className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-black text-xs uppercase tracking-widest">{UI_STRINGS.common.delete} All</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowWipeConfirm(true)} className="w-full flex items-center gap-3 px-6 py-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-2xl font-black text-sm hover:bg-rose-100 transition-all border border-rose-100 dark:border-rose-900/30">
                <Trash2 size={18} /><span>{UI_STRINGS.settings.wipe_vault_btn}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
