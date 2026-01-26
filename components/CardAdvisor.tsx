import React, { useState } from 'react';
import { CreditCard, MultiAdvisorResult, AdvisorDecision } from '../types';
import { analyzeMultiPortfolioRecommendation } from '../services/geminiService';
import { getDecryptedApiKey } from '../utils/storage';
import { Lightbulb, ThumbsUp, ThumbsDown, Scale, Loader2, ArrowRight, AlertTriangle, PlusCircle, CheckCircle2, BrainCircuit, X, Plus, BadgeHelp } from 'lucide-react';
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

  const handleSelectSuggestion = (name: string) => {
      if (!targetCards.includes(name)) {
        setTargetCards([...targetCards, name]);
      }
      setInputName('');
  };

  const handleAddInput = (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault();
    if (inputName.trim() && !targetCards.includes(inputName.trim())) {
      setTargetCards([...targetCards, inputName.trim()]);
      setInputName('');
    }
  };

  const removeTargetCard = (name: string) => {
    setTargetCards(prev => prev.filter(c => c !== name));
  };

  const handleAnalyze = async () => {
    // If user typed something but didn't hit enter, add it to list implicitly
    const cardsToAnalyze = [...targetCards];
    if (inputName.trim() && !targetCards.includes(inputName.trim())) {
        cardsToAnalyze.push(inputName.trim());
        setTargetCards(cardsToAnalyze);
        setInputName('');
    }

    if (cardsToAnalyze.length === 0) return;

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const apiKey = await getDecryptedApiKey(masterKey);
      if (!apiKey) {
        if (onOpenSettings) {
            if (window.confirm("Gemini API Key is missing. Configure it in Settings to use AI features?")) {
                onOpenSettings();
            }
        }
        setLoading(false);
        return;
      }

      const res = await analyzeMultiPortfolioRecommendation(cardsToAnalyze, cards, apiKey);
      if (res && res.length > 0) {
        setResults(res);
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
        case 'APPLY': return <ThumbsUp size={24} />;
        case 'SKIP': return <ThumbsDown size={24} />;
        case 'MANUAL': return <BadgeHelp size={24} />;
        default: return <Scale size={24} />;
    }
  };

  const getDecisionColor = (d: AdvisorDecision) => {
    switch(d) {
        case 'APPLY': return 'bg-emerald-500 text-white shadow-emerald-500/30';
        case 'SKIP': return 'bg-rose-500 text-white shadow-rose-500/30';
        case 'MANUAL': return 'bg-slate-500 text-white shadow-slate-500/30';
        default: return 'bg-amber-500 text-white shadow-amber-500/30';
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-2 text-left">
        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">{UI_STRINGS.advisor.title}</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">{UI_STRINGS.advisor.subtitle}</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-xl border border-slate-100 dark:border-slate-800 space-y-6">
          <div className="space-y-3">
             <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{UI_STRINGS.advisor.input_label}</label>
             
             {/* Chips */}
             <div className="flex flex-wrap gap-2 min-h-[32px]">
                 {targetCards.map(card => (
                    <div key={card} className="animate-in zoom-in duration-200 flex items-center gap-2 pl-4 pr-2 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200 border border-blue-100 dark:border-blue-900/50">
                        <span className="text-xs font-black">{card}</span>
                        <button onClick={() => removeTargetCard(card)} className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full transition-colors"><X size={14} /></button>
                    </div>
                 ))}
             </div>

             <div className="flex gap-2 items-start relative z-20">
                <CardNameInput
                    value={inputName}
                    onChange={setInputName}
                    onSelect={handleSelectSuggestion}
                    masterKey={masterKey}
                    // Removed category prop to default to global search
                    placeholder={targetCards.length > 0 ? UI_STRINGS.advisor.add_another : UI_STRINGS.advisor.input_placeholder}
                    className="flex-grow"
                    showValidationMessage={false}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddInput(e)}
                />
                <button 
                    onClick={() => handleAddInput()}
                    disabled={!inputName.trim()}
                    className="p-4 bg-slate-100 dark:bg-slate-800 rounded-[1.5rem] text-slate-600 dark:text-slate-300 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 h-[60px] shrink-0"
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

          <button 
            onClick={handleAnalyze} 
            disabled={loading || (targetCards.length === 0 && !inputName.trim())}
            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Lightbulb size={20} />}
            <span>{loading ? UI_STRINGS.advisor.analyzing : UI_STRINGS.advisor.analyze_btn} {targetCards.length > 0 && `(${targetCards.length + (inputName.trim() ? 1 : 0)})`}</span>
          </button>
      </div>

      {error && (
        <div className="p-6 bg-rose-50 dark:bg-rose-900/10 text-rose-600 rounded-[2rem] text-center font-bold border border-rose-100 dark:border-rose-900/30 animate-in fade-in slide-in-from-bottom-2">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
            {results.map((result, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-100 dark:border-slate-800">
                     {/* Header with Decision */}
                     <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white truncate">{result.card}</h3>
                        <div className={`px-5 py-2.5 rounded-2xl flex items-center gap-2 self-start md:self-auto ${getDecisionColor(result.decision)}`}>
                            {getDecisionIcon(result.decision)}
                            <span className="text-xs font-black uppercase tracking-widest">{result.decision}</span>
                        </div>
                     </div>

                     {/* Reasoning */}
                     <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                                <BrainCircuit size={16} />
                            </div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-relaxed">{result.reason}</p>
                        </div>
                     </div>

                     {/* Grid of Benefits */}
                     {result.decision !== 'MANUAL' ? (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                             {/* New Value */}
                             <div className="space-y-3">
                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                    <PlusCircle size={16} />
                                    <h4 className="font-black uppercase text-[10px] tracking-[0.2em]">{UI_STRINGS.advisor.section_new}</h4>
                                </div>
                                {result.newValue.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {result.newValue.map((val, i) => (
                                            <div key={i} className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                                {val}
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-xs text-slate-400 italic">No unique benefits found.</p>}
                             </div>

                             {/* Covered */}
                             <div className="space-y-3">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <CheckCircle2 size={16} />
                                    <h4 className="font-black uppercase text-[10px] tracking-[0.2em]">{UI_STRINGS.advisor.section_covered}</h4>
                                </div>
                                {result.covered.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 opacity-70">
                                        {result.covered.map((val, i) => (
                                            <div key={i} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                                                {val}
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-xs text-slate-400 italic">No overlaps found.</p>}
                             </div>
                        </div>
                     ) : (
                        <div className="p-6 text-center">
                            <p className="text-sm font-bold text-slate-500 mb-4">{UI_STRINGS.advisor.ai_verify_failed}</p>
                            <button className="text-xs font-black uppercase tracking-widest text-blue-600 hover:underline">Enter Manually in Wallet</button>
                        </div>
                     )}
                </div>
            ))}
            
            <div className="flex justify-center pt-8">
                 <button onClick={() => { setTargetCards([]); setResults([]); setInputName(''); }} className="text-slate-400 hover:text-blue-500 font-bold text-sm flex items-center gap-2 transition-colors">
                    <span>Start Fresh Comparison</span>
                    <ArrowRight size={16} />
                 </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default CardAdvisor;