
import { Lock, X, ArrowRight, KeyRound, Loader2, ShieldAlert, LifeBuoy, RefreshCw, Trash2, Fingerprint, CheckCircle2, ShieldCheck, ShieldCheck as ShieldIcon, Info } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { 
  setupSecurity, 
  unlockWithMPIN, 
  resetMPINWithSecretWord,
  hasStoredData,
  decryptLocalCards,
  wipeEverything,
  getBiometricEnrolled,
  unlockWithBiometrics,
  enrollBiometricsWithKey
} from '../utils/storage';
import { CreditCard } from '../types';
import { UI_STRINGS } from '../locales/en';

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
  const [isBioEnrolled, setIsBioEnrolled] = useState(getBiometricEnrolled());
  const [useBiometricsDuringSetup, setUseBiometricsDuringSetup] = useState(false);
  const [isBioSetupSuccess, setIsBioSetupSuccess] = useState(false);
  const [isBioAvailable, setIsBioAvailable] = useState(false);
  const [bioHint, setBioHint] = useState<string | null>(null);
  
  const bioTriggered = useRef(false);

  // Check for hardware support on mount
  useEffect(() => {
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(available => {
          setIsBioAvailable(available);
        })
        .catch(() => {
          setIsBioAvailable(false);
        });
    }
  }, []);

  // Handle visibility-aware biometric trigger
  useEffect(() => {
    setMode(initialMode);
    setError('');
    setPin('');
    setConfirmPin('');
    setSecretWord('');

    const tryAutoBioUnlock = () => {
      if (
        initialMode === 'verify' && 
        getBiometricEnrolled() && 
        isBioAvailable && 
        !bioTriggered.current && 
        document.visibilityState === 'visible'
      ) {
        bioTriggered.current = true;
        // Small delay to ensure UI has rendered and settled
        setTimeout(() => {
          handleBiometricUnlock();
        }, 800);
      }
    };

    // Initial check on mount/mode change
    tryAutoBioUnlock();

    // Listener for when user returns to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tryAutoBioUnlock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [initialMode, isBioAvailable]);

  const handleBiometricUnlock = async () => {
    if (isProcessing) return;
    
    if (!isBioEnrolled) {
      setBioHint("Unlock with PIN first, then enable biometrics in Vault Settings.");
      setTimeout(() => setBioHint(null), 5000);
      return;
    }

    setIsProcessing(true);
    setError('');
    try {
      const masterKey = await unlockWithBiometrics();
      if (masterKey) {
        const cards = hasStoredData() ? await decryptLocalCards(masterKey) : [];
        onSuccess(masterKey, cards);
      }
    } catch (err: any) {
      // If user cancels or it fails, allow retry but don't auto-trigger again immediately
      if (err.name !== 'NotAllowedError') {
        console.error("Biometric unlock error:", err);
        setError("Biometric authentication failed.");
      }
      bioTriggered.current = false; // Allow re-trigger if they click the button or return again
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleBiometrics = async () => {
    if (useBiometricsDuringSetup) {
      setUseBiometricsDuringSetup(false);
      setIsBioSetupSuccess(false);
      setError('');
      return;
    }

    if (pin.length < 4) {
      setError(UI_STRINGS.security.bio_setup_prompt);
      return;
    }

    setError('');
    setIsProcessing(true);
    
    try {
      if (!window.navigator.credentials || !window.navigator.credentials.create) {
        throw new Error("Biometrics not supported or blocked by policy.");
      }

      const challenge = window.crypto.getRandomValues(new Uint8Array(32));
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "My Cards AI" },
          user: {
            id: window.crypto.getRandomValues(new Uint8Array(16)),
            name: "user@local",
            displayName: "Local User"
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: { authenticatorAttachment: "platform" },
          timeout: 60000
        }
      });

      if (credential) {
        setUseBiometricsDuringSetup(true);
        setIsBioSetupSuccess(true);
      }
    } catch (bioErr: any) {
      console.warn("Biometric verification failed:", bioErr.message);
      setError(UI_STRINGS.security.bio_verified_error);
      setUseBiometricsDuringSetup(false);
      setIsBioSetupSuccess(false);
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
        if (pin.length < 4) throw new Error(UI_STRINGS.security.mpin_length_error);
        if (pin !== confirmPin) throw new Error(UI_STRINGS.security.mpin_match_error);
        if (secretWord.trim().length < 3) throw new Error(UI_STRINGS.security.secret_word_error);
        
        const masterKey = await setupSecurity(pin, secretWord);
        if (useBiometricsDuringSetup && isBioSetupSuccess) {
            await enrollBiometricsWithKey(masterKey);
        }
        onSuccess(masterKey);
      } else if (mode === 'verify') {
        const masterKey = await unlockWithMPIN(pin);
        if (masterKey) {
          const cards = hasStoredData() ? await decryptLocalCards(masterKey) : [];
          onSuccess(masterKey, cards);
        } else {
          throw new Error(UI_STRINGS.security.mpin_incorrect_error);
        }
      } else if (mode === 'reset') {
        if (pin.length < 4) throw new Error(UI_STRINGS.security.mpin_length_error);
        if (pin !== confirmPin) throw new Error(UI_STRINGS.security.mpin_match_error);
        
        const success = await resetMPINWithSecretWord(secretWord, pin);
        if (success) {
          const masterKey = await unlockWithMPIN(pin);
          if (masterKey) {
            alert(UI_STRINGS.security.reset_success_msg);
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

  const isSubmitDisabled = 
    isProcessing || 
    pin.length < 4 || 
    (mode === 'setup' && (confirmPin !== pin || secretWord.trim().length < 3 || (useBiometricsDuringSetup && !isBioSetupSuccess)));

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center overflow-y-auto custom-scrollbar p-6 py-12 md:py-24 text-left">
      <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 bg-blue-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-500/40 shrink-0">
            {isProcessing ? <Loader2 size={40} className="animate-spin" /> : 
             mode === 'setup' ? <KeyRound size={40} /> : 
             mode === 'reset' ? <RefreshCw size={40} /> : <Lock size={40} />}
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white tracking-tight leading-tight text-center">
              {mode === 'setup' ? UI_STRINGS.security.setup_title : mode === 'reset' ? UI_STRINGS.security.reset_title : UI_STRINGS.security.verify_title}
            </h2>
            <p className="text-slate-400 text-sm font-medium px-4 text-center">
              {mode === 'setup' ? UI_STRINGS.security.setup_subtitle : 
               mode === 'reset' ? UI_STRINGS.security.reset_subtitle :
               UI_STRINGS.security.verify_subtitle}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {(mode === 'setup' || mode === 'reset') && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">{UI_STRINGS.security.recovery_word_label}</label>
                <input
                  type="text"
                  placeholder={UI_STRINGS.security.recovery_word_placeholder}
                  value={secretWord}
                  onChange={e => setSecretWord(e.target.value)}
                  className="w-full py-4 px-6 bg-white/5 border border-white/10 rounded-2xl text-white text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">
                {mode === 'reset' ? UI_STRINGS.security.new_mpin_label : UI_STRINGS.security.mpin_label}
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="••••"
                value={pin}
                onChange={e => {
                    setPin(e.target.value.replace(/\D/g, ''));
                }}
                className="w-full py-5 px-6 bg-white/10 border border-white/20 rounded-3xl text-white text-center text-2xl font-black tracking-[0.5em] focus:ring-4 focus:ring-blue-500/50 outline-none"
                autoFocus
              />
            </div>

            {(mode === 'setup' || mode === 'reset') && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">{UI_STRINGS.security.confirm_mpin_label}</label>
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

            {mode === 'setup' && isBioAvailable && (
              <div 
                className={`p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all border active:scale-95 group ${useBiometricsDuringSetup ? 'bg-blue-600/10 border-blue-600/50' : 'bg-white/5 border-white/10'}`}
                onClick={handleToggleBiometrics}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl transition-colors ${useBiometricsDuringSetup ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                    <Fingerprint size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-white leading-none">{UI_STRINGS.security.use_biometrics}</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">{UI_STRINGS.security.biometrics_subtitle}</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${useBiometricsDuringSetup ? 'bg-blue-600 border-blue-600' : 'border-white/20'}`}>
                   {useBiometricsDuringSetup && <CheckCircle2 size={14} className="text-white" />}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20 animate-in slide-in-from-top-1">
              <ShieldAlert size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {bioHint && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20 animate-in fade-in duration-300">
              <Info size={16} className="shrink-0" />
              <span>{bioHint}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 active:scale-95"
            >
              <span>{mode === 'setup' ? UI_STRINGS.security.set_credentials_btn : mode === 'reset' ? UI_STRINGS.security.reset_title : UI_STRINGS.security.unlock_btn}</span>
              <ArrowRight size={20} />
            </button>

            {mode === 'verify' && isBioAvailable && (
              <button
                type="button"
                onClick={handleBiometricUnlock}
                disabled={isProcessing}
                className={`w-full py-4 rounded-3xl font-black text-sm flex items-center justify-center gap-3 transition-all border active:scale-95 ${isBioEnrolled ? 'bg-white/10 text-white border-white/10 hover:bg-white/20' : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:bg-slate-800'}`}
              >
                <Fingerprint size={20} className={isBioEnrolled ? 'text-blue-400' : 'text-slate-600'} />
                <span>{isBioEnrolled ? UI_STRINGS.security.unlock_bio_btn : "Enable FaceID/TouchID"}</span>
              </button>
            )}

            {mode === 'verify' && (
              <button
                type="button"
                onClick={() => { setMode('reset'); setError(''); }}
                className="w-full py-3 text-slate-500 font-bold hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <LifeBuoy size={16} />
                <span>{UI_STRINGS.security.reset_forgotten_link}</span>
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
                {UI_STRINGS.common.back}
              </button>
            )}
          </div>
        </form>

        <div className="pt-8 text-center pb-12">
            <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-700 uppercase tracking-widest mb-4">
              <ShieldIcon size={12} />
              <span>{UI_STRINGS.security.local_encryption_hint}</span>
            </div>
            <button 
              onClick={() => {
                if(window.confirm(UI_STRINGS.security.emergency_wipe_confirm)) {
                  wipeEverything();
                }
              }}
              className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-slate-800 hover:text-rose-500 transition-colors uppercase tracking-[0.2em]"
            >
              <Trash2 size={12} />
              <span>{UI_STRINGS.security.emergency_wipe_btn}</span>
            </button>
            
            {mode === 'setup' && (
              <div className="mt-8 px-4">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  <span className="font-bold text-slate-400 block mb-1">{UI_STRINGS.privacy.notice_title}</span>
                  {UI_STRINGS.privacy.notice_text}
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SecurityAuth;
