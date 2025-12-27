
import { Lock, X, ArrowRight, KeyRound, Loader2, ShieldAlert, LifeBuoy, RefreshCw, Trash2, Fingerprint } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { 
  setupSecurity, 
  unlockWithMPIN, 
  resetMPINWithSecretWord,
  hasStoredData,
  decryptLocalCards,
  wipeEverything,
  getBiometricEnrolled,
  unlockWithBiometrics
} from '../utils/storage';
import { CreditCard } from '../types';

interface SecurityAuthProps {
  mode: 'setup' | 'verify' | 'reset';
  onSuccess: (masterKey: Uint8Array, decryptedCards?: CreditCard[]) => void;
  onCancel?: () => void;
}

const SecurityAuth: React.FC<SecurityAuthProps> = ({ mode: initialMode, onSuccess, onCancel }) => {
  const [mode, setMode] = useState(initialMode);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [secretWord, setSecretWord] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBioAvailable, setIsBioAvailable] = useState(getBiometricEnrolled());

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setPin('');
    setConfirmPin('');
    setSecretWord('');
    
    // Auto-trigger biometrics if in verify mode
    if (initialMode === 'verify' && getBiometricEnrolled()) {
      handleBiometricUnlock();
    }
  }, [initialMode]);

  const handleBiometricUnlock = async () => {
    setIsProcessing(true);
    setError('');
    try {
      const masterKey = await unlockWithBiometrics();
      if (masterKey) {
        const cards = hasStoredData() ? await decryptLocalCards(masterKey) : [];
        onSuccess(masterKey, cards);
      } else {
        // Silently fail if they cancel the prompt, allowing MPIN fallback
      }
    } catch (err) {
      console.error("Biometric unlock failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsProcessing(true);

    try {
      if (mode === 'setup') {
        if (pin.length < 4) throw new Error('MPIN must be at least 4 digits.');
        if (pin !== confirmPin) throw new Error('MPINs do not match.');
        if (secretWord.trim().length < 3) throw new Error('Secret Word must be at least 3 characters.');
        
        const masterKey = await setupSecurity(pin, secretWord);
        onSuccess(masterKey);
      } else if (mode === 'verify') {
        const masterKey = await unlockWithMPIN(pin);
        if (masterKey) {
          const cards = hasStoredData() ? await decryptLocalCards(masterKey) : [];
          onSuccess(masterKey, cards);
        } else {
          throw new Error('Incorrect MPIN. Please try again.');
        }
      } else if (mode === 'reset') {
        if (pin.length < 4) throw new Error('New MPIN must be at least 4 digits.');
        if (pin !== confirmPin) throw new Error('MPINs do not match.');
        if (secretWord.trim().length < 3) throw new Error('Please enter your valid recovery word.');
        
        const success = await resetMPINWithSecretWord(secretWord, pin);
        if (success) {
          const masterKey = await unlockWithMPIN(pin);
          if (masterKey) {
            alert("MPIN reset successfully!");
            onSuccess(masterKey);
          }
        } else {
          throw new Error('Invalid Secret Word. Recovery failed.');
        }
      }
    } catch (err: any) {
      setError(err.message);
      if (mode === 'verify') setPin('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/40">
            {isProcessing ? <Loader2 size={40} className="animate-spin" /> : 
             mode === 'setup' ? <KeyRound size={40} /> : 
             mode === 'reset' ? <RefreshCw size={40} /> : <Lock size={40} />}
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white tracking-tight leading-tight">
              {mode === 'setup' ? 'Security Setup' : mode === 'reset' ? 'Reset MPIN' : 'App Locked'}
            </h2>
            <p className="text-slate-400 text-sm font-medium px-4">
              {mode === 'setup' ? 'Set an MPIN and a Secret Word for recovery.' : 
               mode === 'reset' ? 'Confirm your secret word to update your MPIN.' :
               'Unlock your encrypted vault to continue.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {(mode === 'setup' || mode === 'reset') && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Recovery Secret Word</label>
                <input
                  type="text"
                  placeholder="e.g. BlueSky77"
                  value={secretWord}
                  onChange={e => setSecretWord(e.target.value)}
                  className="w-full py-4 px-6 bg-white/5 border border-white/10 rounded-2xl text-white text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">
                {mode === 'reset' ? 'New MPIN' : 'MPIN'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="••••"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full py-5 px-6 bg-white/10 border border-white/20 rounded-3xl text-white text-center text-2xl font-black tracking-[0.5em] focus:ring-4 focus:ring-blue-500/50 outline-none"
                autoFocus
              />
            </div>

            {(mode === 'setup' || mode === 'reset') && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Confirm MPIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full py-5 px-6 bg-white/10 border border-white/20 rounded-3xl text-white text-center text-2xl font-black tracking-[0.5em] focus:ring-4 focus:ring-blue-500/50 outline-none"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20 animate-bounce">
              <ShieldAlert size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isProcessing || pin.length < 4}
              className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              <span>{mode === 'setup' ? 'Set Credentials' : mode === 'reset' ? 'Reset Vault' : 'Unlock Now'}</span>
              <ArrowRight size={20} />
            </button>

            {mode === 'verify' && isBioAvailable && (
              <button
                type="button"
                onClick={handleBiometricUnlock}
                disabled={isProcessing}
                className="w-full py-4 bg-white/10 text-white rounded-3xl font-black text-sm flex items-center justify-center gap-3 hover:bg-white/20 transition-all border border-white/10"
              >
                <Fingerprint size={20} className="text-blue-400" />
                <span>Unlock with Biometrics</span>
              </button>
            )}

            {mode === 'verify' && (
              <button
                type="button"
                onClick={() => { setMode('reset'); setError(''); }}
                className="w-full py-3 text-slate-500 font-bold hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <LifeBuoy size={16} />
                <span>Forgot MPIN?</span>
              </button>
            )}

            {(onCancel || mode === 'reset') && mode !== 'verify' && (
              <button
                type="button"
                onClick={() => {
                  if (mode === 'reset' && initialMode === 'verify') {
                    setMode('verify');
                    setError('');
                  } else {
                    onCancel?.();
                  }
                }}
                className="w-full py-3 text-slate-500 font-bold hover:text-slate-300 transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="pt-12">
            <button 
              onClick={() => {
                if(window.confirm("CRITICAL: Wipe all data? This cannot be undone.")) {
                  wipeEverything();
                }
              }}
              className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-slate-700 hover:text-rose-500 transition-colors uppercase tracking-[0.2em]"
            >
              <Trash2 size={12} />
              <span>Emergency Reset App</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default SecurityAuth;
