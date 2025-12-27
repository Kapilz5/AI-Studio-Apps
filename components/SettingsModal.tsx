
import { Cloud, Database, Fingerprint, Loader2, LogIn, LogOut, Mail, RefreshCw, ShieldAlert, ShieldCheck, Trash2, X, Lock as LockIcon, Shield, Smartphone, Share, Plus, RefreshCcw, CheckCircle2, Bell, BellRing } from 'lucide-react';
import React, { useEffect, useState } from 'react';
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

interface SettingsModalProps {
  cards: CreditCard[];
  onCardsSynced: (newCards: CreditCard[]) => void;
  onClose: () => void;
  masterKey: Uint8Array;
  onNotifPeriodChange?: (months: number) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ cards, onCardsSynced, onClose, masterKey, onNotifPeriodChange }) => {
  const [user, setUser] = useState<{ name: string, email: string } | null>(getUser());
  const [isSyncing, setIsSyncing] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(getBiometricEnrolled());
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [showMpinReset, setShowMpinReset] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [notifPeriod, setNotifPeriod] = useState(getNotificationPeriod());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(available => setIsBiometricAvailable(available));
    }
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) setPlatform('ios');
    else if (/android/.test(userAgent)) setPlatform('android');

    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

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
      alert("Failed to restore. The backup might belong to a different security vault.");
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
      const mpin = prompt("Please enter your current MPIN to enroll biometrics:");
      if (mpin) {
        const success = await enrollBiometrics(mpin);
        if (success) {
          setIsBiometricEnrolled(true);
          alert("Biometrics enrolled successfully!");
        } else {
          alert("Failed to enroll biometrics. Please check your MPIN and try again.");
        }
      }
    }
  };

  if (showMpinReset) {
    return (
      <SecurityAuth 
        mode="reset" 
        onSuccess={() => {
          setShowMpinReset(false);
        }} 
        onCancel={() => setShowMpinReset(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in fade-in duration-300 border border-white/10 flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">Settings</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Profile & Security</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={24} className="text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
          {/* User Profile */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Account</label>
            {user ? (
              <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-lg">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-grow">
                  <p className="font-black text-slate-900 dark:text-white text-sm">{user.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                </div>
                <button onClick={handleLogout} className="p-2 text-rose-500"><LogOut size={18} /></button>
              </div>
            ) : (
              <button onClick={() => { const u = { name: "Demo User", email: "demo@example.com" }; setUser(u); saveUser(u); }} className="w-full py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl font-black text-slate-700 dark:text-slate-200 shadow-sm active:scale-95 transition-transform">
                Sign In (Demo)
              </button>
            )}
          </div>

          {/* Notification Settings */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Notification Settings</label>
            <div className="space-y-3">
              <div className="p-6 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center">
                      <BellRing size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">Expiry Alert Lead Time</p>
                      <p className="text-[10px] text-slate-500 font-medium">Months in advance</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-blue-600 dark:text-blue-400">{notifPeriod}M</span>
                </div>
                
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl">
                  {[1, 2, 3, 4, 6].map((m) => (
                    <button
                      key={m}
                      onClick={() => handleUpdateNotifPeriod(m)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${notifPeriod === m ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {notifPermission !== 'granted' ? (
                  <button 
                    onClick={requestNotifPermission}
                    className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <BellRing size={14} />
                    Enable Browser Alerts
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-emerald-500 font-bold text-[10px] uppercase tracking-widest pt-2">
                    <CheckCircle2 size={14} />
                    Alerts Active
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Security & Recovery */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Security & Recovery</label>
            <div className="space-y-3">
              <button 
                onClick={() => setShowMpinReset(true)}
                className="w-full p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center"><RefreshCcw size={20} /></div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Change MPIN</p>
                    <p className="text-[10px] text-slate-500 font-medium">Use Secret Word</p>
                  </div>
                </div>
                <Smartphone size={16} className="text-slate-300" />
              </button>

              <div className="p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isBiometricEnrolled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}><Fingerprint size={20} /></div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Biometric Unlock</p>
                    <p className="text-[10px] text-slate-500 font-medium">FaceID / TouchID</p>
                  </div>
                </div>
                <button onClick={toggleBiometrics} className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${isBiometricEnrolled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isBiometricEnrolled ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Sync */}
          <div className="space-y-4">
             <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Encrypted Sync</label>
             <div className="grid grid-cols-2 gap-3">
                <button onClick={handleSyncToCloud} disabled={!user || isSyncing} className="flex flex-col items-center gap-2 p-5 bg-blue-600 text-white rounded-3xl font-bold shadow-lg shadow-blue-500/20 disabled:opacity-40 transition-all active:scale-95">
                  <Cloud size={24} /><span className="text-xs">Backup</span>
                </button>
                <button onClick={handleRestoreFromCloud} disabled={!user || isSyncing} className="flex flex-col items-center gap-2 p-5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-3xl font-bold disabled:opacity-40 transition-all active:scale-95">
                  <RefreshCw size={24} className={isSyncing ? 'animate-spin' : ''} /><span className="text-xs">Restore</span>
                </button>
             </div>
             {syncStatus === 'success' && (
               <div className="flex items-center justify-center gap-2 text-emerald-500 font-bold text-xs">
                 <CheckCircle2 size={16} /><span>Synced successfully</span>
               </div>
             )}
          </div>

          {/* Danger Zone */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-[10px] font-black text-rose-400 dark:text-rose-500 uppercase tracking-[0.2em]">Danger Zone</label>
            {showWipeConfirm ? (
              <div className="p-5 bg-rose-50 dark:bg-rose-900/20 rounded-3xl border-2 border-rose-200 dark:border-rose-800 animate-in zoom-in duration-200">
                <p className="text-xs text-rose-600 mb-4 font-bold text-center">Delete all local and cloud data permanently?</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowWipeConfirm(false)} className="flex-1 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs">Cancel</button>
                  <button onClick={() => wipeEverything()} className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold text-xs">Wipe Data</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowWipeConfirm(true)} className="w-full flex items-center gap-3 px-6 py-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-2xl font-black text-sm hover:bg-rose-100 transition-all">
                <Trash2 size={18} /><span>Clear All Data</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
