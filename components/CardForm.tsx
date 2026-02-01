
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CardFormData, Benefit, CreditCard } from '../types';
import { fetchCardBenefits, getCardSuggestions } from '../services/geminiService';
import { getDecryptedApiKey } from '../utils/storage';
import { Sparkles, Loader2, X, Camera, CheckCircle2, AlertCircle, Hash, Lock, ShieldAlert, Zap, Search, Palette, ImageIcon } from 'lucide-react';
import CardScanner from './CardScanner';
import CardNameInput from './CardNameInput';
import CardArtStudio from './CardArtStudio';

interface CardFormProps {
  onSave: (data: CardFormData, benefits: Benefit[]) => void;
  onCancel: () => void;
  initialData?: CreditCard;
  cards: CreditCard[];
  masterKey: Uint8Array;
  onOpenSettings?: () => void;
}

// Normalized duplication check helper
const getNormalizedNumber = (num: string) => num.replace(/[\s-]/g, '');

const CardForm: React.FC<CardFormProps> = ({ onSave, onCancel, initialData, cards = [], masterKey, onOpenSettings }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showArtStudio, setShowArtStudio] = useState(false);
  const [pendingBenefits, setPendingBenefits] = useState<Omit<Benefit, 'id'>[]>([]);
  const [decryptedApiKey, setDecryptedApiKey] = useState<string | undefined>(undefined);
  
  const [formData, setFormData] = useState<CardFormData>({
    name: '',
    cardCategory: 'Credit',
    cardType: '',
    fullNumber: '',
    last4: '',
    cvv: '',
    issueDate: new Date().toISOString().split('T')[0],
    expiryMonth: new Date().getMonth() + 1,
    expiryYear: (new Date().getFullYear() + 3) % 100,
    annualFee: 0,
    creditLimit: 0,
    waiverCondition: '',
    waiverTarget: 0,
    currentSpend: 0,
    bestOffer: '',
    status: 'active',
    customSkin: ''
  });

  const [isFetching, setIsFetching] = useState(false);
  const [fetchedBenefits, setFetchedBenefits] = useState<Omit<Benefit, 'id'>[]>([]);
  const benefitSectionRef = useRef<HTMLDivElement>(null);

  // Decrypt API key on mount for suggestions
  useEffect(() => {
    const loadKey = async () => {
        const key = await getDecryptedApiKey(masterKey);
        setDecryptedApiKey(key);
    };
    loadKey();
  }, [masterKey]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        cardCategory: initialData.cardCategory || 'Credit',
        cardType: initialData.cardType || '',
        fullNumber: initialData.fullNumber || '',
        last4: initialData.last4,
        cvv: initialData.cvv || '',
        issueDate: initialData.issueDate,
        expiryMonth: initialData.expiryMonth,
        expiryYear: initialData.expiryYear % 100,
        annualFee: initialData.annualFee,
        creditLimit: initialData.creditLimit,
        waiverCondition: initialData.waiverCondition,
        waiverTarget: initialData.waiverTarget,
        currentSpend: initialData.currentSpend,
        bestOffer: initialData.bestOffer || '',
        status: initialData.status || 'active',
        customSkin: initialData.customSkin || ''
      });
      setFetchedBenefits(initialData.benefits);
    }
  }, [initialData]);

  const duplicateCard = useMemo(() => {
    const currentNum = getNormalizedNumber(formData.fullNumber);
    if (!currentNum || currentNum.length < 4) return null;
    
    return cards.find(c => {
      if (initialData && c.id === initialData.id) return false;
      return getNormalizedNumber(c.fullNumber) === currentNum;
    });
  }, [formData.fullNumber, cards, initialData]);

  const handleFetchBenefits = useCallback(async (nameOverride?: string) => {
    const cardName = (nameOverride || formData.name).trim();
    if (!cardName) return;
    
    setIsFetching(true);
    try {
      const apiKey = decryptedApiKey || await getDecryptedApiKey(masterKey);
      if (!apiKey) {
        if (onOpenSettings) {
             if (window.confirm("Gemini API Key is missing. Configure it in Settings to use AI features?")) {
                 onOpenSettings();
             }
        } else {
             alert("Please set your Gemini API Key in Settings to use AI features.");
        }
        setIsFetching(false);
        return;
      }

      const result = await fetchCardBenefits(cardName, formData.cardCategory, apiKey);
      if (result.benefits.length > 0) {
        setPendingBenefits(result.benefits);
        setShowConfirmation(true);
      } else {
        alert(result.error || 'AI check completed. No official perks found for this specific name.');
      }
    } catch (error: any) {
      alert(error.message || 'Service unreachable. Check internet connection.');
    } finally {
      setIsFetching(false);
    }
  }, [formData.name, formData.cardCategory, masterKey, onOpenSettings, decryptedApiKey]);

  const confirmBenefits = () => {
    setFetchedBenefits(pendingBenefits);
    if (pendingBenefits.length > 0) {
      const topBenefit = pendingBenefits.find(b => b.category === 'Travel' || b.category === 'Shopping') || pendingBenefits[0];
      setFormData(prev => ({ ...prev, bestOffer: topBenefit.detail }));
    }
    setShowConfirmation(false);
    
    setTimeout(() => {
        benefitSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  const handleScanComplete = useCallback((scannedData: any) => {
    const scannedYear = scannedData.expiryYear ? scannedData.expiryYear % 100 : undefined;

    setFormData(prev => ({
      ...prev,
      name: scannedData.name || prev.name,
      cardCategory: scannedData.cardCategory || prev.cardCategory,
      cardType: scannedData.cardType || prev.cardType,
      fullNumber: scannedData.fullNumber || prev.fullNumber,
      cvv: scannedData.cvv || prev.cvv,
      last4: scannedData.last4 || prev.last4,
      expiryMonth: scannedData.expiryMonth || prev.expiryMonth,
      expiryYear: scannedYear !== undefined ? scannedYear : prev.expiryYear,
      annualFee: scannedData.suggestedAnnualFee || prev.annualFee,
      waiverTarget: scannedData.suggestedWaiverTarget || prev.waiverTarget,
    }));
    setShowScanner(false);
    if (scannedData.name) {
      setTimeout(() => handleFetchBenefits(scannedData.name), 100);
    }
  }, [handleFetchBenefits]);

  const handleScannerCancel = useCallback(() => {
    setShowScanner(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.expiryMonth || formData.expiryYear === undefined || duplicateCard) return;

    const cleanNum = getNormalizedNumber(formData.fullNumber);
    const last4 = cleanNum.length >= 4 ? cleanNum.slice(-4) : formData.last4;
    const finalYear = formData.expiryYear < 100 ? 2000 + formData.expiryYear : formData.expiryYear;

    // Status Logic
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const isDateExpired = finalYear < currentYear || (finalYear === currentYear && formData.expiryMonth < currentMonth);
    const finalStatus = isDateExpired ? 'expired' : 'active';

    const benefitsWithIds: Benefit[] = fetchedBenefits.map((b, i) => ({
      ...b,
      id: (b as any).id || `${Date.now()}-${i}`,
      category: b.category as any
    }));

    onSave({ ...formData, expiryYear: finalYear, last4, status: finalStatus }, benefitsWithIds);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      {showConfirmation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in slide-in-from-bottom-4 duration-300 border border-white/10">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20">
              <Sparkles size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">AI Insights Found</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-6">Confirm rewards to add them to your local vault.</p>
            
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 mb-8 custom-scrollbar">
              {pendingBenefits.map((b, i) => (
                <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-start gap-4">
                  <div className="mt-1 bg-emerald-500/10 text-emerald-500 p-1 rounded-lg">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-[0.2em]">{b.category}</span>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-tight">{b.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
               <button 
                onClick={() => setShowConfirmation(false)}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
               >
                 Decline
               </button>
               <button 
                onClick={confirmBenefits}
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2"
               >
                 <Zap size={14} />
                 <span>Apply Insights</span>
               </button>
            </div>
          </div>
        </div>
      )}

      {showScanner && <CardScanner onScanComplete={handleScanComplete} onCancel={handleScannerCancel} masterKey={masterKey} onOpenSettings={onOpenSettings} />}
      {showArtStudio && <CardArtStudio onApply={(img) => { setFormData(prev => ({ ...prev, customSkin: img })); setShowArtStudio(false); }} onCancel={() => setShowArtStudio(false)} masterKey={masterKey} onOpenSettings={onOpenSettings} />}

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative border border-slate-100 dark:border-slate-800 flex flex-col">
        <div className="p-8 pb-0">
          <div className="flex justify-between items-center mb-8">
            <div className="text-left">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Onboarding</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1 uppercase tracking-widest">Encrypted Vault</p>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X size={24} className="text-slate-400 dark:text-slate-500" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
              {!initialData && (
                <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="flex flex-col items-center justify-center gap-2 py-5 rounded-3xl bg-slate-900 dark:bg-slate-950 text-white font-black shadow-xl hover:bg-black transition-all active:scale-95 group border border-white/5 uppercase text-[10px] tracking-[0.1em]"
                >
                    <Camera size={20} className="text-blue-400 group-hover:scale-110 transition-transform" />
                    <span>Scan Card</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowArtStudio(true)}
                className={`flex flex-col items-center justify-center gap-2 py-5 rounded-3xl font-black shadow-xl transition-all active:scale-95 group border border-white/5 uppercase text-[10px] tracking-[0.1em] ${formData.customSkin ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
              >
                {formData.customSkin ? <ImageIcon size={20} className="text-white" /> : <Palette size={20} className="text-purple-500" />}
                <span>{formData.customSkin ? "Edit Skin" : "Design Skin"}</span>
              </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 pt-0 space-y-8 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Product Tier</label>
              <div className="grid grid-cols-2 gap-4">
                 <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, cardCategory: 'Credit' });
                  }}
                  className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all ${formData.cardCategory === 'Credit' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'}`}
                 >
                   Credit
                 </button>
                 <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...formData, cardCategory: 'Debit' });
                  }}
                  className={`py-4 rounded-2xl font-black text-xs uppercase tracking-widest border-2 transition-all ${formData.cardCategory === 'Debit' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'}`}
                 >
                   Debit
                 </button>
              </div>
            </div>

            <div className="md:col-span-2 relative">
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Product Name</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <CardNameInput
                  value={formData.name}
                  onChange={(val) => setFormData({ ...formData, name: val })}
                  onSelect={(val) => setFormData({ ...formData, name: val })}
                  apiKey={decryptedApiKey}
                  placeholder={`e.g. HDFC Millennia`}
                  className="flex-grow"
                  category={formData.cardCategory}
                />
                
                <button
                  type="button"
                  onClick={() => handleFetchBenefits()}
                  disabled={isFetching || !formData.name.trim()}
                  className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-500/30 h-[60px]"
                >
                  {isFetching ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  <span>Check AI</span>
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">PAN-Digital Identifier (Number)</label>
              <div className="relative">
                <Hash className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="0000 0000 0000 0000"
                  required
                  value={formData.fullNumber}
                  onChange={e => {
                      const cleanVal = e.target.value.replace(/\D/g, '');
                      const formatted = cleanVal.match(/.{1,4}/g)?.join(' ') || cleanVal;
                      setFormData(prev => ({ 
                          ...prev, 
                          fullNumber: formatted.slice(0, 19)
                      }));
                  }}
                  className={`w-full pl-14 pr-5 py-4 rounded-2xl border-2 ${duplicateCard ? 'border-rose-400' : 'border-slate-100 dark:border-slate-700'} dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-xl tracking-[0.1em]`}
                />
              </div>
              {duplicateCard && (
                <div className="mt-3 flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 rounded-2xl animate-in shake">
                  <ShieldAlert size={18} className="text-rose-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                    Duplicate: <span className="underline">{duplicateCard.name}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
               <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Expiry Date</label>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    min="1"
                    max="12"
                    required
                    placeholder="MM"
                    value={formData.expiryMonth}
                    onChange={e => {
                      const val = Math.min(12, Math.max(1, Number(e.target.value)));
                      setFormData({ ...formData, expiryMonth: isNaN(val) ? 1 : val });
                    }}
                    className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none font-bold"
                  />
                  <input
                    type="number"
                    min="0"
                    max="99"
                    required
                    placeholder="YY"
                    value={formData.expiryYear}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setFormData({ ...formData, expiryYear: isNaN(val) ? 2028 : val });
                    }}
                    className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none font-bold"
                  />
               </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Security CVV</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="***"
                  value={formData.cvv}
                  onChange={e => setFormData({ ...formData, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  className="w-full pl-14 pr-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xl tracking-[0.5em]"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Network Brand</label>
              <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="text"
                    placeholder="Visa, RuPay, etc."
                    value={formData.cardType}
                    onChange={e => setFormData({ ...formData, cardType: e.target.value })}
                    className="w-full pl-14 pr-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none font-bold uppercase"
                  />
              </div>
            </div>
          </div>

          <div ref={benefitSectionRef} className={`p-8 rounded-[2rem] border-2 transition-all duration-500 ${fetchedBenefits.length > 0 ? 'bg-blue-50/30 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 opacity-60'}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${fetchedBenefits.length > 0 ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400'}`}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white leading-none">AI Profile</h3>
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">{fetchedBenefits.length} Insights Loaded</p>
                </div>
              </div>
              {fetchedBenefits.length > 0 && <CheckCircle2 className="text-emerald-500" size={24} />}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-60 overflow-y-auto pr-3 custom-scrollbar">
              {fetchedBenefits.length > 0 ? (
                fetchedBenefits.map((benefit, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-50 dark:border-slate-700 shadow-sm animate-in zoom-in duration-300">
                    <span className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1">{benefit.category}</span>
                    <p className="text-slate-900 dark:text-slate-100 text-[10px] font-bold leading-tight">{benefit.detail}</p>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-6 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">AI Insights Pending</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-8 flex gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-[2rem] font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!duplicateCard}
              className="flex-[2] py-5 bg-blue-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all shadow-2xl shadow-blue-500/40 disabled:opacity-50"
            >
              Commit to Vault
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CardForm;
