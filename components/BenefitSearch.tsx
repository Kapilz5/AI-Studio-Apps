
import React, { useState, useMemo } from 'react';
import { CreditCard, BenefitCategory } from '../types';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';
import { Search, ChevronRight, Trophy, Sparkles, Star, CreditCard as LucideCreditCard, AlertCircle } from 'lucide-react';
import { UI_STRINGS } from '../locales/en';

interface BenefitSearchProps {
  cards: CreditCard[];
}

// Semantic mapping for query expansion
const KEYWORD_ALIASES: Record<string, string[]> = {
  // Fuel & Auto
  'petrol': ['fuel', 'oil', 'diesel', 'gas', 'surcharge', 'pump'],
  'diesel': ['fuel', 'oil', 'petrol', 'gas', 'surcharge'],
  'fuel': ['petrol', 'diesel', 'oil', 'gas', 'surcharge', 'station'],
  'gas': ['fuel', 'cng', 'petrol'],

  // Travel & Commute
  'travel': ['flight', 'hotel', 'airline', 'airport', 'train', 'bus', 'booking', 'yatra', 'makemytrip', 'easemytrip', 'lounge'],
  'flight': ['air', 'travel', 'indigo', 'vistara', 'air india', 'airport'],
  'airport': ['lounge', 'terminal', 'travel', 'access', 'priority pass'],
  'lounge': ['airport', 'access', 'priority pass', 'dreamfolks'],
  'train': ['irctc', 'rail', 'railway'],
  'cab': ['uber', 'ola', 'taxi', 'ride'],
  
  // Entertainment
  'movie': ['cinema', 'film', 'ticket', 'bookmyshow', 'pvr', 'inox', 'theatre', 'entertainment', 'show'],
  'entertainment': ['movie', 'cinema', 'ott', 'netflix', 'prime', 'hotstar', 'subscription'],
  
  // Food & Dining
  'food': ['dining', 'restaurant', 'swiggy', 'zomato', 'eats', 'delivery', 'burger', 'pizza', 'cafe'],
  'dining': ['restaurant', 'food', 'buffet', 'hotel', 'dinner', 'lunch'],
  'grocery': ['supermarket', 'bigbasket', 'blinkit', 'instamart', 'zepto', 'kirana', 'daily'],

  // Shopping
  'shopping': ['amazon', 'flipkart', 'myntra', 'ajio', 'tata', 'reliance', 'mall', 'retail', 'store', 'brand'],
  'online': ['amazon', 'flipkart', 'e-commerce', 'web'],

  // Bills & Utilities
  'bill': ['utility', 'electricity', 'water', 'gas', 'recharge', 'mobile', 'broadband', 'dth'],
  'utility': ['bill', 'electricity'],
  
  // Health
  'health': ['medical', 'hospital', 'pharmacy', 'medicine', 'doctor', 'apollo', '1mg', 'pharmeasy'],
};

const BenefitSearch: React.FC<BenefitSearchProps> = ({ cards }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BenefitCategory | 'All'>('All');

  const activeCards = useMemo(() => cards.filter(c => c.status !== 'expired'), [cards]);

  const filteredBenefits = useMemo(() => {
    const results: { cardName: string; category: BenefitCategory; detail: string; cardId: string; cardType?: string }[] = [];
    
    // Pre-calculate search tokens
    const normalizedSearch = searchTerm.toLowerCase().trim();
    let searchTokens: string[] = [];
    
    if (normalizedSearch) {
      searchTokens = [normalizedSearch]; // Always include the exact term
      
      // Expand with aliases
      Object.keys(KEYWORD_ALIASES).forEach(key => {
        if (normalizedSearch.includes(key)) {
          searchTokens.push(...KEYWORD_ALIASES[key]);
        }
      });
    }

    activeCards.forEach(card => {
      card.benefits.forEach(benefit => {
        const matchesCategory = selectedCategory === 'All' || benefit.category === selectedCategory;
        
        if (!matchesCategory) return;

        let matchesSearch = false;
        
        if (normalizedSearch === '') {
            matchesSearch = true;
        } else {
            const content = `${benefit.detail} ${benefit.category} ${card.name}`.toLowerCase();
            // Check if any token matches the content
            matchesSearch = searchTokens.some(token => content.includes(token));
        }
        
        if (matchesSearch) {
          results.push({
            cardName: card.name,
            category: benefit.category,
            detail: benefit.detail,
            cardId: card.id,
            cardType: card.cardType
          });
        }
      });
    });
    
    return results;
  }, [activeCards, searchTerm, selectedCategory]);

  const bestCardForSelected = useMemo(() => {
    if (selectedCategory === 'All' || activeCards.length === 0) return null;
    
    const relevantBenefits: { card: CreditCard, benefit: any, score: number }[] = [];
    
    activeCards.forEach(card => {
      const b = card.benefits.find(b => b.category === selectedCategory);
      if (b) {
        let score = 1;
        if (b.detail.toLowerCase().includes('unlimited')) score += 5;
        if (b.detail.toLowerCase().includes('%')) {
          const match = b.detail.match(/(\d+)%/);
          if (match) score += parseInt(match[1]);
        }
        relevantBenefits.push({ card, benefit: b, score });
      }
    });

    return relevantBenefits.sort((a, b) => b.score - a.score)[0] || null;
  }, [activeCards, selectedCategory]);

  const renderBrandLogo = (type?: string) => {
    const t = (type || '').toLowerCase();
    const containerClass = "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg rotate-3 group-hover:rotate-0 transition-transform overflow-hidden bg-white/90 backdrop-blur border border-white/20 shrink-0";

    if (t.includes('visa')) return <div className={containerClass}><span className="text-[#1a1f71] font-black italic text-[9px] tracking-tighter leading-none">VISA</span></div>;
    if (t.includes('mastercard')) return <div className={containerClass}><div className="flex -space-x-1.5 items-center"><div className="w-3.5 h-3.5 rounded-full bg-[#eb001b]" /><div className="w-3.5 h-3.5 rounded-full bg-[#f79e1b] opacity-90" /></div></div>;
    if (t.includes('amex') || t.includes('american')) return <div className={`${containerClass} bg-[#016fd0] border-none`}><span className="text-[7px] font-black text-white italic">AMEX</span></div>;
    if (t.includes('rupay')) return <div className={containerClass}><div className="text-[8px] font-black italic tracking-tighter leading-none"><span className="text-[#f37021]">Ru</span><span className="text-[#253b80]">Pay</span></div></div>;
    return <div className={`${containerClass} card-gradient border-none`}><LucideCreditCard size={18} className="text-white/80" /></div>;
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-2 text-left animate-in slide-in-from-left-4 duration-500">
        <h2 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-500 tracking-tighter leading-tight">{UI_STRINGS.benefits_explorer.title}</h2>
        <p className="text-slate-500 dark:text-slate-400 font-bold text-lg">{UI_STRINGS.benefits_explorer.subtitle}</p>
      </div>

      <div className="relative group animate-in fade-in zoom-in duration-500 delay-100">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={24} />
        <input
          type="text"
          placeholder={UI_STRINGS.benefits_explorer.search_placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-16 pr-6 py-6 rounded-full bg-white/60 dark:bg-slate-800/60 shadow-xl border border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-blue-500/20 focus:outline-none transition-all dark:text-white text-xl font-bold backdrop-blur-md"
        />
        {searchTerm && (
            <div className="absolute right-6 top-1/2 -translate-y-1/2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-200/50 dark:bg-slate-700/50 px-3 py-1.5 rounded-full backdrop-blur-sm">AI Search Active</span>
            </div>
        )}
      </div>

      {selectedCategory !== 'All' && (
        <div className="animate-in slide-in-from-top-8 duration-500">
           {bestCardForSelected ? (
             <div className="p-10 rounded-[3rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 text-white shadow-2xl shadow-indigo-500/40 flex flex-col md:flex-row items-center gap-8 border border-white/20 relative overflow-hidden group hover:scale-[1.01] transition-transform duration-500">
                <div className="absolute top-0 right-0 p-12 opacity-10 scale-[2.5] rotate-12 group-hover:scale-[3] transition-transform duration-1000">
                   {CATEGORY_ICONS[selectedCategory as BenefitCategory]}
                </div>
                <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center backdrop-blur-xl shrink-0 border border-white/20 shadow-inner group-hover:scale-110 transition-transform duration-500 group-hover:bg-white/20">
                   <Trophy size={48} className="text-yellow-300 drop-shadow-lg" />
                </div>
                <div className="flex-grow text-center md:text-left space-y-2 min-w-0 relative z-10">
                   <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                      <Sparkles size={16} className="text-yellow-300" />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-100">{UI_STRINGS.benefits_explorer.ai_recommendation}</p>
                   </div>
                   <h3 className="text-4xl font-black tracking-tighter truncate drop-shadow-md">{bestCardForSelected.card.name}</h3>
                   <p className="text-lg font-bold text-indigo-50 leading-relaxed max-w-xl line-clamp-2">{bestCardForSelected.benefit.detail}</p>
                </div>
                <div className="shrink-0 relative z-10">
                   <div className="flex items-center gap-2 bg-black/20 px-6 py-3 rounded-full border border-white/10 backdrop-blur-md shadow-lg">
                      <Star size={16} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{UI_STRINGS.benefits_explorer.premium_pick}</span>
                   </div>
                </div>
             </div>
           ) : (
             <div className="p-10 rounded-[3rem] bg-slate-100 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center gap-4">
                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-300 shadow-sm"><AlertCircle size={32} /></div>
                <div className="space-y-1">
                   <p className="text-lg font-black text-slate-900 dark:text-white">
                    {UI_STRINGS.benefits_explorer.empty_category.replace('{category}', selectedCategory)}
                   </p>
                   <p className="text-sm text-slate-500 font-medium">{UI_STRINGS.benefits_explorer.no_results_subtitle}</p>
                </div>
             </div>
           )}
        </div>
      )}

      <div className="overflow-x-auto pb-6 -mx-4 px-4 custom-scrollbar">
        <div className="flex gap-3 w-max">
            <button
            onClick={() => setSelectedCategory('All')}
            className={`px-8 py-4 rounded-full text-[10px] font-black transition-all uppercase tracking-widest border border-transparent ${
                selectedCategory === 'All' 
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl scale-105' 
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            >
            {UI_STRINGS.benefits_explorer.all_categories}
            </button>
            {CATEGORIES.map(cat => (
            <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center space-x-3 px-8 py-4 rounded-full text-[10px] font-black transition-all uppercase tracking-widest border border-transparent ${
                selectedCategory === cat 
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30 scale-105' 
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
            >
                <span className={selectedCategory === cat ? 'text-white' : 'text-blue-500'}>{CATEGORY_ICONS[cat]}</span>
                <span>{cat}</span>
            </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBenefits.length > 0 ? (
          filteredBenefits.map((item, idx) => (
            <div key={`${item.cardId}-${idx}`} className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group text-left cursor-default">
              <div className="flex justify-between items-start mb-6">
                <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full shadow-sm ${CATEGORY_COLORS[item.category]}`}>
                  {item.category}
                </span>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:scale-110 transition-transform shadow-inner">
                   {CATEGORY_ICONS[item.category]}
                </div>
              </div>
              <p className="text-slate-900 dark:text-slate-100 font-bold text-lg mb-8 flex-grow leading-snug line-clamp-3">{item.detail}</p>
              <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-4 min-w-0">
                  {renderBrandLogo(item.cardType)}
                  <div className="space-y-0.5 min-w-0">
                     <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">On Card</span>
                     <span className="block text-sm font-black text-slate-900 dark:text-white truncate max-w-[140px] leading-none" title={item.cardName}>{item.cardName}</span>
                  </div>
                </div>
                <button className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0 shadow-sm">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-32 text-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[4rem] border border-dashed border-slate-300 dark:border-slate-700">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-slate-300 dark:text-slate-600">
               <Search size={48} />
            </div>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">{UI_STRINGS.benefits_explorer.no_results_title}</h4>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">{UI_STRINGS.benefits_explorer.no_results_subtitle}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BenefitSearch;
