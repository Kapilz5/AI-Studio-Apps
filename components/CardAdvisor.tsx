
import React, { useState } from 'react';
import { CreditCard } from '../types';
import { analyzePortfolioRecommendation, AdvisorResult } from '../services/geminiService';
import { getDecryptedApiKey } from '../utils/storage';
import { Lightbulb, ThumbsUp, ThumbsDown, Scale, Loader2, Search, ArrowRight, AlertTriangle, PlusCircle, CheckCircle2, MinusCircle, BrainCircuit } from 'lucide-react';
import { UI_STRINGS } from '../locales/en';

interface CardAdvisorProps {
  cards: CreditCard[];
  masterKey: Uint8Array;
  onOpenSettings?: () => void;
}

const CardAdvisor: React.FC<CardAdvisorProps> = ({ cards, masterKey, onOpenSettings }) => {
  const [inputName, setInputName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [error, setError] = useState('');

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

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

      const res = await analyzePortfolioRecommendation(inputName, cards, apiKey);
      if (res) {
        setResult(res);
      } else {
        setError(UI_STRINGS.advisor.analysis_failed);
      }
    } catch (err: any) {
      setError(err.message || UI_STRINGS.advisor.analysis_failed);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-emerald-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getVerdictLabel = (rec: string) => {
    if (rec === 'Apply') return UI_STRINGS.advisor.verdict_recommended;
    if (rec === 'Skip') return UI_STRINGS.advisor.verdict_skip;
    return UI_STRINGS.advisor.verdict_optional;
  };

  const getVerdictColorClass = (rec: string) => {
    if (rec === 'Apply') return 'bg-emerald-500 shadow-emerald-500/30';
    if (rec === 'Skip') return 'bg-rose-500 shadow-rose-500/30';
    return 'bg-amber-500 shadow-amber-500/30';
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="space-y-2 text-left">
        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">{UI_STRINGS.advisor.title}</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">{UI_STRINGS.advisor.subtitle}</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-xl border border-slate-100 dark:border-slate-800">
        <form onSubmit={handleAnalyze} className="flex flex-col gap-6">
          <div className="relative">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">{UI_STRINGS.advisor.input_label}</label>
            <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    placeholder={UI_STRINGS.advisor.input_placeholder}
                    className="w-full pl-14 pr-6 py-6 rounded-[2rem] bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 focus:border-blue-500 outline-none text-lg font-bold text-slate-900 dark:text-white transition-all"
                />
            </div>
          </div>
          
          {cards.length === 0 && (
             <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                <AlertTriangle size={18} className="shrink-0" />
                <p className="text-xs font-bold">{UI_STRINGS.advisor.empty_vault_warning}</p>
             </div>
          )}

          <button 
            type="submit" 
            disabled={loading || !inputName.trim()}
            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Lightbulb size={20} />}
            <span>{loading ? UI_STRINGS.advisor.analyzing : UI_STRINGS.advisor.analyze_btn}</span>
          </button>
        </form>
      </div>

      {error && (
        <div className="p-6 bg-rose-50 dark:bg-rose-900/10 text-rose-600 rounded-[2rem] text-center font-bold border border-rose-100 dark:border-rose-900/30 animate-in fade-in slide-in-from-bottom-2">
          {error}
        </div>
      )}

      {result && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 space-y-6">
          {/* Verdict Card */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800">
             <div className={`p-8 text-center text-white ${getVerdictColorClass(result.recommendation)} relative overflow-hidden`}>
                <div className="relative z-10 flex flex-col items-center">
                   {result.recommendation === 'Apply' ? <ThumbsUp size={48} className="mb-2" /> : result.recommendation === 'Skip' ? <ThumbsDown size={48} className="mb-2" /> : <Scale size={48} className="mb-2" />}
                   <h3 className="text-4xl font-black tracking-tight uppercase">{getVerdictLabel(result.recommendation)}</h3>
                   <div className="mt-4 bg-black/20 px-4 py-2 rounded-xl backdrop-blur-md border border-white/20 flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{UI_STRINGS.advisor.score_label}</span>
                      <span className="text-xl font-black">{result.score}/100</span>
                   </div>
                </div>
                {/* Decorative background shapes */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-black/10 rounded-full blur-3xl" />
             </div>
             
             <div className="p-8 bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3">
                   <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                      <BrainCircuit size={20} />
                   </div>
                   <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">{UI_STRINGS.advisor.reasoning_label}</span>
                      <p className="text-slate-700 dark:text-slate-200 font-bold leading-relaxed">
                        {result.reasoning}
                      </p>
                   </div>
                </div>
             </div>

             <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* NEW BENEFITS */}
                <div className="space-y-4">
                   <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                      <PlusCircle size={20} />
                      <h4 className="font-black uppercase text-xs tracking-[0.2em]">{UI_STRINGS.advisor.section_new}</h4>
                   </div>
                   {result.newBenefits && result.newBenefits.length > 0 ? (
                      <div className="space-y-2">
                         {result.newBenefits.map((item, i) => (
                           <div key={i} className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold leading-tight">
                              {item}
                           </div>
                         ))}
                      </div>
                   ) : (
                      <p className="text-xs text-slate-400 italic pl-2">No significant new benefits detected.</p>
                   )}
                </div>

                <div className="space-y-6">
                    {/* ALREADY COVERED */}
                    <div className="space-y-4">
                       <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                          <CheckCircle2 size={20} />
                          <h4 className="font-black uppercase text-xs tracking-[0.2em]">{UI_STRINGS.advisor.section_covered}</h4>
                       </div>
                       {result.alreadyCovered && result.alreadyCovered.length > 0 ? (
                          <div className="space-y-2">
                             {result.alreadyCovered.map((item, i) => (
                               <div key={i} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[11px] font-bold leading-tight opacity-80">
                                  {item}
                               </div>
                             ))}
                          </div>
                       ) : (
                          <p className="text-xs text-slate-400 italic pl-2">No direct overlaps found.</p>
                       )}
                    </div>

                    {/* SIMILAR */}
                    <div className="space-y-4">
                       <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 mb-2">
                          <MinusCircle size={20} />
                          <h4 className="font-black uppercase text-xs tracking-[0.2em]">{UI_STRINGS.advisor.section_similar}</h4>
                       </div>
                       {result.similarBenefits && result.similarBenefits.length > 0 ? (
                          <div className="space-y-2">
                             {result.similarBenefits.map((item, i) => (
                               <div key={i} className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold leading-tight">
                                  {item}
                               </div>
                             ))}
                          </div>
                       ) : (
                          <p className="text-xs text-slate-400 italic pl-2">No similar benefits found.</p>
                       )}
                    </div>
                </div>
             </div>

             <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                 <button onClick={() => { setInputName(''); setResult(null); }} className="text-slate-400 hover:text-blue-500 font-bold text-sm flex items-center gap-2 transition-colors">
                    <span>Analyze Another</span>
                    <ArrowRight size={16} />
                 </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardAdvisor;
