
import React, { useState, useMemo } from 'react';
import { CreditCard, BenefitCategory } from '../types';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';
import { Search, ChevronRight, Trophy, Sparkles, Star, CreditCard as LucideCreditCard, AlertCircle } from 'lucide-react';

interface BenefitSearchProps {
  cards: CreditCard[];
}

const BenefitSearch: React.FC<BenefitSearchProps> = ({ cards }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BenefitCategory | 'All'>('All');

  const filteredBenefits = useMemo(() => {
    const results: { cardName: string; category: BenefitCategory; detail: string; cardId: string; cardType?: string }[] = [];
    
    cards.forEach(card => {
      card.benefits.forEach(benefit => {
        const matchesSearch = searchTerm === '' || 
          benefit.detail.toLowerCase().includes(searchTerm.toLowerCase()) ||
          benefit.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          card.name.toLowerCase().includes(searchTerm.toLowerCase());
          
        const matchesCategory = selectedCategory === 'All' || benefit.category === selectedCategory;
        
        if (matchesSearch && matchesCategory) {
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
  }, [cards, searchTerm, selectedCategory]);

  const bestCardForSelected = useMemo(() => {
    if (selectedCategory === 'All' || cards.length === 0) return null;
    
    const relevantBenefits: { card: CreditCard, benefit: any, score: number }[] = [];
    
    cards.forEach(card => {
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
  }, [cards, selectedCategory]);

  const renderBrandLogo = (type?: string) => {
    const t = (type || '').toLowerCase();
    
    const containerClass = "w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg rotate-3 group-hover:rotate-0 transition-transform overflow-hidden bg-white border border-slate-100 dark:border-slate-800";

    if (t.includes('visa')) {
      return (
        <div className={containerClass}>
          <span className="text-[#1a1f71] font-black italic text-[10px] tracking-tighter leading-none">VISA</span>
        </div>
      );
    }
    if (t.includes('mastercard')) {
      return (
        <div className={containerClass}>
          <div className="flex -space-x-1.5 items-center">
            <div className="w-3.5 h-3.5 rounded-full bg-[#eb001b]" />
            <div className="w-3.5 h-3.5 rounded-full bg-[#f79e1b] opacity-90" />
          </div>
        </div>
      );
    }
    if (t.includes('amex') || t.includes('american')) {
      return (
        <div className={`${containerClass} bg-[#016fd0] border-white/20`}>
          <span className="text-[7px] font-black text-white italic">AMEX</span>
        </div>
      );
    }
    if (t.includes('rupay')) {
      return (
        <div className={containerClass}>
          <div className="text-[8px] font-black italic tracking-tighter leading-none">
            <span className="text-[#f37021]">Ru</span><span className="text-[#253b80]">Pay</span>
          </div>
        </div>
      );
    }
    if (t.includes('discover')) {
      return (
        <div className={containerClass}>
          <span className="text-[#ff6000] font-black italic text-[8px] tracking-tighter leading-none uppercase">Disc</span>
        </div>
      );
    }
    
    return (
      <div className={`${containerClass} card-gradient border-none`}>
        <LucideCreditCard size={18} className="text-white/80" />
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-2">
        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">Reward Explorer</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">Pick the optimal card for your current purchase.</p>
      </div>

      <div className="relative group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={24} />
        <input
          type="text"
          placeholder="Search rewards (e.g., 'Amazon', 'Lounge', '10%')..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-14 pr-6 py-6 rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-xl border border-slate-100 dark:border-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all dark:text-white text-xl font-bold"
        />
      </div>

      {selectedCategory !== 'All' && (
        <div className="animate-in slide-in-from-top-4 duration-500">
           {bestCardForSelected ? (
             <div className="p-8 rounded-[3rem] bg-gradient-to-br from-indigo-600 via-blue-600 to-blue-700 text-white shadow-2xl shadow-blue-500/30 flex flex-col md:flex-row items-center gap-8 border border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-5 scale-[2.5] rotate-12 group-hover:scale-[3] transition-transform duration-700">
                   {CATEGORY_ICONS[selectedCategory as BenefitCategory]}
                </div>
                <div className="w-20 h-20 bg-white/20 rounded-[2rem] flex items-center justify-center backdrop-blur-xl shrink-0 border border-white/20 shadow-inner">
                   <Trophy size={40} className="text-yellow-300 animate-bounce-slow" />
                </div>
                <div className="flex-grow text-center md:text-left space-y-2">
                   <div className="flex items-center justify-center md:justify-start gap-2">
                      <Sparkles size={14} className="text-yellow-300" />
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-100">AI Top Recommendation</p>
                   </div>
                   <h3 className="text-3xl font-black tracking-tight">{bestCardForSelected.card.name}</h3>
                   <p className="text-base font-bold text-blue-50 leading-relaxed max-w-xl">{bestCardForSelected.benefit.detail}</p>
                </div>
                <div className="shrink-0">
                   <div className="flex items-center gap-2 bg-black/30 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-md">
                      <Star size={16} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Premium Pick</span>
                   </div>
                </div>
             </div>
           ) : (
             <div className="p-10 rounded-[3rem] bg-slate-100 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center gap-4">
                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-300 shadow-sm"><AlertCircle size={32} /></div>
                <div className="space-y-1">
                   <p className="text-lg font-black text-slate-900 dark:text-white">No {selectedCategory} Rewards</p>
                   <p className="text-sm text-slate-500 font-medium">Add cards with {selectedCategory.toLowerCase()} benefits to see them here.</p>
                </div>
             </div>
           )}
        </div>
      )}

      <div className="overflow-x-auto pb-6 -mx-4 px-4 custom-scrollbar">
        <div className="flex gap-3 w-max">
            <button
            onClick={() => setSelectedCategory('All')}
            className={`px-8 py-4 rounded-[1.5rem] text-xs font-black transition-all uppercase tracking-widest border-2 ${
                selectedCategory === 'All' 
                ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/30' 
                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:border-blue-200'
            }`}
            >
            All Categories
            </button>
            {CATEGORIES.map(cat => (
            <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center space-x-3 px-8 py-4 rounded-[1.5rem] text-xs font-black transition-all uppercase tracking-widest border-2 ${
                selectedCategory === cat 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/30' 
                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:border-blue-200'
                }`}
            >
                <span className={selectedCategory === cat ? 'text-white' : 'text-blue-500'}>{CATEGORY_ICONS[cat]}</span>
                <span>{cat}</span>
            </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredBenefits.length > 0 ? (
          filteredBenefits.map((item, idx) => (
            <div key={`${item.cardId}-${idx}`} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col hover:shadow-2xl hover:-translate-y-2 transition-all group">
              <div className="flex justify-between items-start mb-6">
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl shadow-sm ${CATEGORY_COLORS[item.category]}`}>
                  {item.category}
                </span>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:scale-110 transition-transform">
                   {CATEGORY_ICONS[item.category]}
                </div>
              </div>
              <p className="text-slate-900 dark:text-slate-100 font-bold text-lg mb-8 flex-grow leading-tight">{item.detail}</p>
              <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-50 dark:border-slate-800">
                <div className="flex items-center space-x-4">
                  {renderBrandLogo(item.cardType)}
                  <div className="space-y-0.5">
                     <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">On Card</span>
                     <span className="text-base font-black text-slate-900 dark:text-white truncate max-w-[140px] leading-none">{item.cardName}</span>
                  </div>
                </div>
                <button className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-32 text-center bg-white dark:bg-slate-900 rounded-[4rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-slate-200 dark:text-slate-700">
               <Search size={48} />
            </div>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-2">No Matches Found</h4>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">We couldn't find any benefits matching your search. Try adjusting filters or search terms.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BenefitSearch;
