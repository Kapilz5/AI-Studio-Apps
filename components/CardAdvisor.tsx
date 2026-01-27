

import React, { useState, useEffect } from 'react';
import { CreditCard, MultiAdvisorResult, AdvisorDecision, CardCategory } from '../types';
import { analyzeMultiPortfolioRecommendation } from '../services/geminiService';
import { getDecryptedApiKey, getProStatus, getAdvisorUsage, incrementAdvisorUsage } from '../utils/storage';
import { Lightbulb, ThumbsUp, ThumbsDown, Scale, Loader2, ArrowRight, AlertTriangle, PlusCircle, CheckCircle2, BrainCircuit, X, Plus, BadgeHelp, Play, Shield, ExternalLink, Download, Lock } from 'lucide-react';
import { UI_STRINGS } from '../locales/en';
import CardNameInput from './CardNameInput';

interface CardAdvisorProps {
  cards: CreditCard[];
  masterKey: Uint8Array;
  onOpenSettings?: () => void;
}

const CardAdvisor: React.FC<CardAdvisorProps> = ({ cards, masterKey, onOpenSettings }) => {
  const [inputName, setInputName] = useState('');
  const [targetCards, setTargetCards] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MultiAdvisorResult[]>([]);
  const [error, setError] = useState('');
  const [decryptedApiKey, setDecryptedApiKey] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<CardCategory>('Credit');
  
  // Monetization State
  const [isPro, setIsPro] = useState(false);
  const [usage, setUsage] = useState({ count: 0, limit: 20 });
  const [limitReached, setLimitReached] = useState(false);

  // Decrypt API key and load pro status on mount
  useEffect(() => {
    const init = async () => {
        const key = await getDecryptedApiKey(masterKey);
        setDecryptedApiKey(key);
        
        const pro = await getProStatus();
        setIsPro(pro);
        
        const u = await getAdvisorUsage();
        setUsage({ count: u.count, limit: u.limit });
        setLimitReached(u.remaining <= 0);
    };
    init();
  }, [masterKey]);

  const handleSelectSuggestion = (name: string) => {
      if (name && !targetCards.includes(name)) {
        setTargetCards([...targetCards, name]);
      }
      setInputName('');
  };

  const handleAddInput = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputName.trim() && !targetCards.includes(inputName.trim())) {
      setTargetCards([...targetCards, inputName.trim()]);
      setInputName('');
    }
  };

  const removeTargetCard = (name: string) => {
    setTargetCards(prev => prev.filter(c => c !== name));
  };
  
  const handleExport = () => {
      if (!results.length) return;
      
      const text = results.map(r => {
          return `CARD: ${r.card}\nDECISION: ${r.decision}\nREASON: ${r.reason}\n\n`;
      }).join('----------------\n');
      
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mycards_advisor_${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
  };

  const handleAnalyze = async () => {
    // Check usage limits if not pro
    if (!isPro) {
        const currentUsage = await getAdvisorUsage();
        if (currentUsage.remaining <= 0) {
            setLimitReached(true);
            return;
        }
    }

    // Include the text in input if user hasn't hit enter yet
    const cardsToAnalyze = [...targetCards];
    if (inputName.trim() && !targetCards.includes(inputName.trim())) {
        cardsToAnalyze.push(inputName.trim());
    }

    if (cardsToAnalyze.length === 0) return;

    setLoading(true);
    setError('');
    setResults([]); 

    try {
      const apiKey = decryptedApiKey || await getDecryptedApiKey(masterKey);
      if (!apiKey) {
        if (onOpenSettings) {
            if (window.confirm("Gemini API Key is missing. Configure it in Settings to use AI features?")) {
                onOpenSettings();
            }
        } else {
            setError("API Key missing. Please configure in settings.");
        }
        setLoading(false);
        return;
      }

      const res = await analyzeMultiPortfolioRecommendation(cardsToAnalyze, cards, apiKey);
      if (res && res.length > 0) {
        setResults(res);
        // Clear input state only on success
        setTargetCards([]);
        setInputName('');
        
        // Increment usage
        if (!isPro) {
            await incrementAdvisorUsage();
            const newUsage = await getAdvisorUsage();
            setUsage({ count: newUsage.count, limit: newUsage.limit });
            setLimitReached(newUsage.remaining <= 0);
        }
      } else {
        setError(UI_STRINGS.advisor.analysis_failed);
      }
    } catch (err: any) {
      setError(err.message || UI_STRINGS.advisor.analysis_failed);
    } finally {
      setLoading(false);
    }
  };

  const getDecisionIcon = (d: AdvisorDecision) => {
    switch(d) {
        case 'APPLY': return <ThumbsUp size={20} />;
        case 'SKIP': return <ThumbsDown size={20} />;
        case 'MANUAL': return <BadgeHelp size={20} />;
        default: return <Scale size={20} />;
    }
  };

  const getDecisionStyles = (d: AdvisorDecision) => {
    switch(d) {
        case 'APPLY': return 'bg-emerald-500 text-white shadow-emerald-500/30 ring-emerald-500/20';
        case 'SKIP': return 'bg-rose-500 text-white shadow-rose-500/30 ring-rose-500/20';
        case 'MANUAL': return 'bg-slate-500 text-white shadow-slate-500/30 ring-slate-500/20';
        default: return 'bg-amber-500 text-white shadow-amber-500/30 ring-amber-500/20';
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-2 text-left">
        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">{UI_STRINGS.advisor.title}</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">{UI_STRINGS.advisor.subtitle}</p>
      </div>

      {/* Input Section */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-xl border border-slate-100 dark:border-slate-800 space-y-6">
          <div className="space-y-4">
             <div className="flex items-center justify-between">
               <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{UI_STRINGS.advisor.input_label}</label>
               <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                  <button 
                    onClick={() => setSelectedCategory('Credit')}
                    className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${selectedCategory === 'Credit' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Credit
                  </button>
                  <button 
                    onClick={() => setSelectedCategory('Debit')}
                    className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${selectedCategory === 'Debit' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}
                  >
                    Debit
                  </button>
               </div>
             </div>
             
             {/* Target Chips */}
             {targetCards.length > 0 && (
                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
                    {targetCards.map(card => (
                        <div key={card} className="flex items-center gap-2 pl-4 pr-2 py-2.5 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200 border border-blue-100 dark:border-blue-900/50 shadow-sm transition-all hover:scale-105">
                            <span className="text-xs font-black">{card}</span>
                            <button onClick={() => removeTargetCard(card)} className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full transition-colors"><X size={14} /></button>
                        </div>
                    ))}
                </div>
             )}

             <div className="flex gap-2">
                <CardNameInput
                    value={inputName}
                    onChange={setInputName}
                    onSelect={handleSelectSuggestion}
                    apiKey={decryptedApiKey}
                    placeholder={targetCards.length > 0 ? UI_STRINGS.advisor.add_another : UI_STRINGS.advisor.input_placeholder}
                    className="flex-grow"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddInput(e)}
                    category={selectedCategory}
                />
                <button 
                    onClick={() => handleAddInput()}
                    disabled={!inputName.trim()}
                    className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 active:scale-95"
                >
                    <Plus size={24} />
                </button>
             </div>
          </div>
          
          {cards.length === 0 && (
             <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                <AlertTriangle size={18} className="shrink-0" />
                <p className="text-xs font-bold">{UI_STRINGS.advisor.empty_vault_warning}</p>
             </div>
          )}

          {limitReached && !isPro ? (
              <div className="p-6 bg-slate-900 dark:bg-indigo-900/30 text-white rounded-[2rem] text-center border border-white/10 shadow-lg animate-in zoom-in">
                  <h3 className="text-lg font-black mb-1">{UI_STRINGS.monetization.limit_reached_title}</h3>
                  <p className="text-sm font-medium text-slate-300 mb-4">{UI_STRINGS.monetization.limit_reached_subtitle}</p>
                  <button 
                    onClick={() => onOpenSettings?.()}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-500/40"
                  >
                      {UI_STRINGS.monetization.limit_upgrade_action}
                  </button>
              </div>
          ) : (
            <button 
                onClick={handleAnalyze} 
                disabled={loading || (targetCards.length === 0 && !inputName.trim())}
                className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                <span>{loading ? UI_STRINGS.advisor.analyzing : UI_STRINGS.advisor.analyze_btn} {targetCards.length > 0 && `(${targetCards.length + (inputName.trim() ? 1 : 0)})`}</span>
            </button>
          )}
          
          {!isPro && !limitReached && (
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                 Free Uses Remaining: {usage.count} / {usage.limit}
              </p>
          )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-6 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-[2rem] text-center font-bold border border-rose-100 dark:border-rose-900/30 animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center gap-3 shadow-lg">
          <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm"><AlertTriangle size={24} /></div>
          <p>{error}</p>
          <button onClick={handleAnalyze} className="text-xs font-black uppercase tracking-widest underline hover:text-rose-700 dark:hover:text-rose-300">Retry Analysis</button>
        </div>
      )}

      {/* Results Section */}
      {results.length > 0 && (
        <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center gap-2 px-4 opacity-50">
                <Lightbulb size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Analysis Results</span>
            </div>

            {results.map((result, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 group">
                     {/* Header */}
                     <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-transparent to-slate-50 dark:to-slate-800/50 rounded-bl-full -z-0 opacity-50" />
                        
                        <div className="relative z-10">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">Target Card</span>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none tracking-tight">{result.card}</h3>
                        </div>

                        <div className={`relative z-10 px-6 py-3 rounded-2xl flex items-center gap-3 self-start md:self-auto ring-4 ring-opacity-50 ${getDecisionStyles(result.decision)}`}>
                            {getDecisionIcon(result.decision)}
                            <span className="text-sm font-black uppercase tracking-widest">{result.decision}</span>
                        </div>
                     </div>

                     {/* Reasoning */}
                     <div className="p-8 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-start gap-4">
                            <div className="mt-1 p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                                <BrainCircuit size={20} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Reasoning</p>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{result.reason}</p>
                            </div>
                        </div>
                     </div>

                     {/* Benefits Grid */}
                     {result.decision !== 'MANUAL' ? (
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                             {/* New Value */}
                             <div className="space-y-4">
                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                    <PlusCircle size={18} />
                                    <h4 className="font-black uppercase text-[10px] tracking-[0.2em]">{UI_STRINGS.advisor.section_new}</h4>
                                </div>
                                {result.newValue && result.newValue.length > 0 ? (
                                    <div className="space-y-2">
                                        {result.newValue.map((val, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                                                <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                                                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100 leading-tight">{val}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-xs text-slate-400 italic px-2">No unique benefits found.</p>}
                             </div>

                             {/* Covered / Already Owned */}
                             <div className="space-y-4">
                                <div className="flex items-center gap-2 text-amber-500">
                                    <Shield size={18} />
                                    <h4 className="font-black uppercase text-[10px] tracking-[0.2em]">{UI_STRINGS.advisor.section_covered}</h4>
                                </div>
                                {result.alreadyCovered && result.alreadyCovered.length > 0 ? (
                                    <div className="space-y-3">
                                        {result.alreadyCovered.map((item, i) => (
                                            <div key={i} className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                                <p className="text-xs font-bold text-amber-900 dark:text-amber-100 mb-1 leading-tight">{item.benefit}</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {item.coveredBy.map((card, idx) => (
                                                        <span key={idx} className="text-[9px] font-black uppercase tracking-wider bg-white dark:bg-slate-900/50 px-2 py-1 rounded text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800">{card}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                  // Fallback for older API responses or no overlap
                                  result.covered && result.covered.length > 0 ? (
                                      <div className="flex flex-wrap gap-2 opacity-60">
                                          {result.covered.map((val, i) => (
                                              <div key={i} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                                                  {val}
                                              </div>
                                          ))}
                                      </div>
                                  ) : <p className="text-xs text-slate-400 italic px-2">No significant overlaps.</p>
                                )}
                             </div>
                        </div>
                     ) : (
                        <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/20">
                            <p className="text-sm font-bold text-slate-500 mb-4">{UI_STRINGS.advisor.ai_verify_failed}</p>
                            <button onClick={() => removeTargetCard(result.card)} className="text-xs font-black uppercase tracking-widest text-rose-500 hover:underline">Remove from analysis</button>
                        </div>
                     )}

                     {/* Footer Actions */}
                     <div className="px-8 pb-8 flex items-center justify-between gap-4">
                        {result.decision === 'APPLY' && (
                            <button className="flex items-center gap-2 px-6 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all">
                                <span>{UI_STRINGS.advisor.apply_partner}</span>
                                <ExternalLink size={14} />
                            </button>
                        )}
                     </div>
                </div>
            ))}
            
            <div className="flex flex-col items-center gap-4 pt-4 pb-12">
                 {isPro ? (
                    <button onClick={handleExport} className="flex items-center gap-2 text-slate-400 hover:text-blue-500 font-bold text-xs uppercase tracking-widest transition-colors">
                        <Download size={14} />
                        <span>{UI_STRINGS.advisor.export_btn}</span>
                    </button>
                 ) : (
                    <div className="flex items-center gap-2 text-slate-300 dark:text-slate-600 font-bold text-xs uppercase tracking-widest select-none">
                        <Lock size={14} />
                        <span>Export locked (Pro only)</span>
                    </div>
                 )}
                 <button onClick={() => { setTargetCards([]); setResults([]); setInputName(''); }} className="group px-8 py-4 bg-slate-100 dark:bg-slate-800 rounded-[2rem] text-slate-500 dark:text-slate-300 font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all hover:bg-slate-200 dark:hover:bg-slate-700">
                    <span>Start Fresh Comparison</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                 </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default CardAdvisor;