
import { Cloud, Database, Fingerprint, Loader2, LogIn, LogOut, Mail, RefreshCw, ShieldAlert, ShieldCheck, Trash2, X, Lock as LockIcon, Shield, Smartphone, Share, Plus, RefreshCcw, CheckCircle2, Bell, BellRing, User } from 'lucide-react';
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
  const [user, setUser] = useState<{ name: string, email: string, picture?: string } | null>(getUser());
  const [isSyncing, setIsSyncing] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(getBiometricEnrolled());
  const [notifPeriod, setNotifPeriod] = useState(getNotificationPeriod());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [showMpinReset, setShowMpinReset] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const handleLogout = () => { setUser(null); saveUser(null); };

  // Mock Google Identity Services logic for high-end UI feel
  const handleGoogleLogin = () => {
    setIsSyncing(true);
    // In a real environment, you'd use google.accounts.id.prompt()
    // Simulate a successful login for the user
    setTimeout(() => {
      const googleUser = {
        name: "Devoted User",
        email: "bhakti.nidhi@google.com",
        picture: "https://lh3.googleusercontent.com/a/default-user=s120-c"
      };
      setUser(googleUser);
      saveUser(googleUser);
      setIsSyncing(false);
    }, 1500);
  };

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
      const mpin = prompt("Confirm MPIN to enroll biometrics:");
      if (mpin) {
        const success = await enrollBiometrics(mpin);
        if (success) {
          setIsBiometricEnrolled(true);
        } else {
          alert("Biometric enrollment failed. Check device settings.");
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
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in fade-in duration-300 border border-white/10 flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
          <div className="text-left">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">Settings</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Profile & Security</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={24} className="text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
          {/* Google Account */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] text-left">Connected Account</label>
            {user ? (
              <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 flex items-center gap-4 group transition-all">
                <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-lg border-2 border-white dark:border-slate-600">
                  <img src={user.picture || `https://ui-avatars.com/api/?name=${user.name}&background=random`} alt="User" className="w-full h-full object-cover" />
                </div>
                <div className="flex-grow text-left">
                  <p className="font-black text-slate-900 dark:text-white text-sm">{user.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                </div>
                <button onClick={handleLogout} className="p-3 text-slate-400 hover:text-rose-500 transition-colors">
                    <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleGoogleLogin} 
                disabled={isSyncing}
                className="w-full py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl font-black text-slate-700 dark:text-slate-200 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-3 hover:border-blue-500 hover:text-blue-600 group"
              >
                {isSyncing ? <Loader2 size={20} className="animate-spin text-blue-500" /> : (
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                <span>Sign in with Google</span>
              </button>
            )}
          </div>

          {/* Sync & Backup */}
          <div className="space-y-4">
             <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] text-left">Encrypted Cloud Sync</label>
             <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleSyncToCloud} 
                  disabled={!user || isSyncing} 
                  className="flex flex-col items-center gap-2 p-5 bg-blue-600 text-white rounded-3xl font-bold shadow-lg shadow-blue-500/20 disabled:opacity-40 transition-all active:scale-95 group"
                >
                  <Cloud size={24} className="group-hover:scale-110 transition-transform" />
                  <span className="text-xs">Backup Now</span>
                </button>
                <button 
                  onClick={handleRestoreFromCloud} 
                  disabled={!user || isSyncing} 
                  className="flex flex-col items-center gap-2 p-5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-3xl font-bold disabled:opacity-40 transition-all active:scale-95 group"
                >
                  <RefreshCw size={24} className={`${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                  <span className="text-xs">Fetch Cloud</span>
                </button>
             </div>
             {syncStatus === 'success' && (
               <div className="flex items-center justify-center gap-2 text-emerald-500 font-bold text-xs animate-in slide-in-from-bottom-2">
                 <CheckCircle2 size={16} /><span>Synced successfully</span>
               </div>
             )}
          </div>

          {/* Notification Settings */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] text-left">Notifications</label>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-[2rem] shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center">
                    <BellRing size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-slate-900 dark:text-white">Expiry Lead Time</p>
                    <p className="text-[10px] text-slate-500 font-medium">Alerts before expiry</p>
                  </div>
                </div>
                <span className="text-lg font-black text-blue-600 dark:text-blue-400">{notifPeriod}M</span>
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
                  Enable Browser Alerts
                </button>
              )}
            </div>
          </div>

          {/* Security & Recovery */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] text-left">Security Management</label>
            <div className="space-y-3">
              <button 
                onClick={() => setShowMpinReset(true)}
                className="w-full p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm group"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform"><RefreshCcw size={20} /></div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Update MPIN</p>
                    <p className="text-[10px] text-slate-500 font-medium">Verify with Secret Word</p>
                  </div>
                </div>
                <Smartphone size={16} className="text-slate-300" />
              </button>

              <div className="p-5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4 text-left">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isBiometricEnrolled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}><Fingerprint size={20} /></div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Biometric Login</p>
                    <p className="text-[10px] text-slate-500 font-medium">FaceID / TouchID</p>
                  </div>
                </div>
                <button onClick={toggleBiometrics} className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${isBiometricEnrolled ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isBiometricEnrolled ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-[10px] font-black text-rose-400 dark:text-rose-500 uppercase tracking-[0.2em] text-left">Danger Zone</label>
            {showWipeConfirm ? (
              <div className="p-5 bg-rose-50 dark:bg-rose-900/20 rounded-3xl border-2 border-rose-200 dark:border-rose-800 animate-in zoom-in duration-200">
                <p className="text-xs text-rose-600 mb-4 font-black text-center">Delete all local and cloud data permanently?</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowWipeConfirm(false)} className="flex-1 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-widest">Keep Safe</button>
                  <button onClick={() => wipeEverything()} className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest">Wipe Data</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowWipeConfirm(true)} className="w-full flex items-center gap-3 px-6 py-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-2xl font-black text-sm hover:bg-rose-100 transition-all">
                <Trash2 size={18} /><span>Purge All Vault Data</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
