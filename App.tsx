
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, LayoutGrid, ArrowUpDown, Wallet, Moon, Sun, ShieldCheck, UserCircle, Sparkles, Lock, Calendar, Clock, TrendingUp, CreditCard as CardIcon, BarChart3, Search, X, ChevronRight, Info } from 'lucide-react';
import { CreditCard, CardFormData, Benefit } from './types';
import { hasStoredData, getMPINHash, saveCards, decryptLocalCards, getNotificationPeriod } from './utils/storage';
import CardItem from './components/CardItem';
import CardForm from './components/CardForm';
import BenefitSearch from './components/BenefitSearch';
import SecurityAuth from './components/SecurityAuth';
import SettingsModal from './components/SettingsModal';

type ViewMode = 'Dashboard' | 'Explorer';

const App: React.FC = () => {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>('Dashboard');
  const [sortOrder, setSortOrder] = useState<'age' | 'expiry'>('age');
  const [searchTerm, setSearchTerm] = useState('');
  const [expiryPopup, setExpiryPopup] = useState<{ title: string; group: CreditCard[] } | null>(null);
  const [notificationPeriod, setNotificationPeriodState] = useState(getNotificationPeriod());
  
  // Security States
  const [isAppLocked, setIsAppLocked] = useState(true);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);
  
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const pinHash = getMPINHash();
    if (!pinHash) {
      setIsSetupRequired(true);
      setIsAppLocked(false);
    } else {
      setIsAppLocked(true);
    }
  }, []);

  // Expiry Notification Logic
  useEffect(() => {
    if (!isAppLocked && cards.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
      const now = new Date();
      const expiringCards = cards.filter(card => {
        const expiryDate = new Date(card.expiryYear, card.expiryMonth - 1);
        const diffMs = expiryDate.getTime() - now.getTime();
        const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
        return diffMonths > 0 && diffMonths <= notificationPeriod;
      });

      if (expiringCards.length > 0) {
        const names = expiringCards.map(c => c.name).join(', ');
        new Notification('Card Expiry Alert', {
          body: `${expiringCards.length} card(s) expiring within ${notificationPeriod} month(s): ${names}`,
          icon: 'https://cdn-icons-png.flaticon.com/512/9334/9334530.png'
        });
      }
    }
  }, [isAppLocked, cards, notificationPeriod]);

  const handleUnlockSuccess = useCallback((key: Uint8Array, decryptedCards?: CreditCard[]) => {
    setMasterKey(key);
    if (decryptedCards) {
      setCards(decryptedCards);
    }
    setIsAppLocked(false);
    setIsSetupRequired(false);
  }, []);

  const handleSaveCard = async (data: CardFormData, benefits: Benefit[]) => {
    if (!masterKey) return;

    let updatedCards: CreditCard[];
    if (editingCard) {
      updatedCards = cards.map(c => 
        c.id === editingCard.id ? { ...c, ...data, benefits } : c
      );
    } else {
      const newCard: CreditCard = {
        ...data,
        id: Date.now().toString(),
        benefits
      };
      updatedCards = [...cards, newCard];
    }
    
    setCards(updatedCards);
    await saveCards(updatedCards, masterKey);
    closeForm();
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCard(undefined);
  };

  const handleUpdateSpend = async (id: string, additionalAmount: number) => {
    if (!masterKey) return;
    const updated = cards.map(card => 
      card.id === id ? { ...card, currentSpend: card.currentSpend + additionalAmount } : card
    );
    setCards(updated);
    await saveCards(updated, masterKey);
  };

  const handleDeleteCard = async (id: string) => {
    if (!masterKey) return;
    const updated = cards.filter(c => c.id !== id);
    setCards(updated);
    await saveCards(updated, masterKey);
  };

  const handleEditCard = (card: CreditCard) => {
    setEditingCard(card);
    setIsFormOpen(true);
  };

  const onCardsSynced = (newCards: CreditCard[]) => {
    setCards(newCards);
  };

  const handleNotifPeriodChange = (months: number) => {
    setNotificationPeriodState(months);
  };

  const earliestExpiryCards = useMemo(() => {
    if (cards.length === 0) return [];
    const sorted = [...cards].sort((a, b) => {
      if (a.expiryYear !== b.expiryYear) return a.expiryYear - b.expiryYear;
      return a.expiryMonth - b.expiryMonth;
    });
    const first = sorted[0];
    return cards.filter(c => c.expiryMonth === first.expiryMonth && c.expiryYear === first.expiryYear);
  }, [cards]);

  const latestExpiryCards = useMemo(() => {
    if (cards.length === 0) return [];
    const sorted = [...cards].sort((a, b) => {
      if (a.expiryYear !== b.expiryYear) return b.expiryYear - a.expiryYear;
      return b.expiryMonth - a.expiryMonth;
    });
    const last = sorted[0];
    return cards.filter(c => c.expiryMonth === last.expiryMonth && c.expiryYear === last.expiryYear);
  }, [cards]);

  const totalFees = useMemo(() => cards.reduce((sum, c) => sum + c.annualFee, 0), [cards]);
  const totalLimit = useMemo(() => cards.reduce((sum, c) => sum + (c.creditLimit || 0), 0), [cards]);

  const filteredCards = useMemo(() => {
    if (!searchTerm) return cards;
    return cards.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.last4.includes(searchTerm)
    );
  }, [cards, searchTerm]);

  const sortedCards = useMemo(() => {
    return [...filteredCards].sort((a, b) => {
      if (sortOrder === 'age') {
        return Number(a.id) - Number(b.id);
      } else {
        if (a.expiryYear !== b.expiryYear) return a.expiryYear - b.expiryYear;
        return a.expiryMonth - b.expiryMonth;
      }
    });
  }, [filteredCards, sortOrder]);

  const renderExpiryMetricValue = (group: CreditCard[], title: string) => {
    if (group.length === 0) return <span className="text-slate-400">0 Cards</span>;
    if (group.length === 1) return <span className="truncate">{group[0].name}</span>;
    
    return (
      <div className="flex items-center gap-2 truncate">
        <span className="truncate">{group[0].name}</span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setExpiryPopup({ title, group });
          }}
          className="shrink-0 text-[10px] font-black bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full hover:bg-blue-200 transition-colors"
        >
          +{group.length - 1} more
        </button>
      </div>
    );
  };

  if (isAppLocked || isSetupRequired) {
    return (
      <SecurityAuth 
        mode={isSetupRequired ? "setup" : "verify"} 
        onSuccess={handleUnlockSuccess} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-32 md:pb-12 transition-colors duration-300">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 md:w-12 md:h-12 card-gradient rounded-2xl shadow-xl flex items-center justify-center text-white rotate-3">
              <Wallet size={24} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1">My Cards</h1>
              <div className="flex items-center space-x-2">
                <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Secure Vault</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="hidden md:flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <button 
                onClick={() => setViewMode('Dashboard')}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${viewMode === 'Dashboard' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <LayoutGrid size={18} />
                <span>Wallet</span>
              </button>
              <button 
                onClick={() => setViewMode('Explorer')}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${viewMode === 'Explorer' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Sparkles size={18} />
                <span>Benefits</span>
              </button>
            </div>

            <button 
              onClick={() => setIsDark(!isDark)}
              className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-200 dark:border-slate-800"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-200 dark:border-slate-800"
            >
              <UserCircle size={18} />
            </button>
            <button 
              onClick={() => setIsFormOpen(true)}
              className="flex items-center space-x-2 px-5 md:px-6 py-3 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 active:scale-95"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Add Card</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {viewMode === 'Dashboard' ? (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                    <CardIcon size={24} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Cards</span>
                </div>
                <p className="text-4xl font-black text-slate-900 dark:text-white mb-2">{cards.length}</p>
                <div className="flex gap-2">
                   <p className="text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                     {cards.filter(c => c.cardCategory === 'Credit').length} Credit
                   </p>
                   <p className="text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg">
                     {cards.filter(c => c.cardCategory === 'Debit').length} Debit
                   </p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center">
                    <Calendar size={24} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Expiry</span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white mb-1">
                  {renderExpiryMetricValue(earliestExpiryCards, "Cards Expiring Soon")}
                </div>
                {earliestExpiryCards.length > 0 && (
                  <p className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/50 px-3 py-1 rounded-full inline-block mt-1">
                    {String(earliestExpiryCards[0].expiryMonth).padStart(2, '0')}/{earliestExpiryCards[0].expiryYear}
                  </p>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
                    <Clock size={24} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Furthest Expiry</span>
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white mb-1">
                  {renderExpiryMetricValue(latestExpiryCards, "Furthest Expiry Cards")}
                </div>
                {latestExpiryCards.length > 0 && (
                  <p className="text-xs font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/50 px-3 py-1 rounded-full inline-block mt-1">
                    {String(latestExpiryCards[0].expiryMonth).padStart(2, '0')}/{latestExpiryCards[0].expiryYear}
                  </p>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                    <BarChart3 size={24} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Portfolio Value</span>
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">
                  ₹{totalLimit.toLocaleString()}
                </p>
                <p className="text-xs font-bold text-slate-500">Total Credit Power</p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center">
                    <TrendingUp size={24} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Annual Cost</span>
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">
                  ₹{totalFees.toLocaleString()}
                </p>
                <p className="text-xs font-bold text-slate-500">Combined Maintenance</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Financial Fleet</h3>
                <div className="flex items-center gap-2">
                  <Info size={12} className="text-slate-400 shrink-0" />
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    AI-fetched data like benefits and fees are estimates and should be verified with the card issuer.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="relative flex-grow max-w-md group">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                   <input 
                    type="text" 
                    placeholder="Quick search cards..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all font-bold"
                   />
                </div>
                
                <button 
                  onClick={() => setSortOrder(sortOrder === 'age' ? 'expiry' : 'age')}
                  className="flex items-center space-x-2 px-6 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-black shadow-sm"
                >
                  <ArrowUpDown size={18} className="text-blue-600" />
                  <span>{sortOrder === 'age' ? 'Date Added' : 'Expiry Date'}</span>
                </button>
              </div>

              {cards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {sortedCards.map(card => (
                    <CardItem 
                      key={card.id} 
                      card={card} 
                      onDelete={handleDeleteCard} 
                      onEdit={handleEditCard}
                      onUpdateSpend={handleUpdateSpend}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-32 text-center bg-white dark:bg-slate-900 rounded-[4rem] border-2 border-dashed border-slate-200 dark:border-slate-800 max-w-2xl mx-auto px-8">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-8 text-slate-200 dark:text-slate-700">
                    <Plus size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">No Cards Saved</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium mb-10">Start by scanning or manually adding your credit and debit cards to your secure vault.</p>
                  <button 
                    onClick={() => setIsFormOpen(true)}
                    className="px-12 py-5 bg-blue-600 text-white rounded-[2rem] font-black hover:bg-blue-700 transition-all shadow-2xl shadow-blue-500/40 active:scale-95"
                  >
                    Add First Card
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <BenefitSearch cards={cards} />
          </div>
        )}
      </main>

      {/* Expiry List Popup */}
      {expiryPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-sm rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-300">
             <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                      <Calendar size={20} />
                   </div>
                   <div>
                      <h4 className="font-black text-slate-900 dark:text-white">{expiryPopup.title}</h4>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Shared Date</p>
                   </div>
                </div>
                <button onClick={() => setExpiryPopup(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                   <X size={20} className="text-slate-400" />
                </button>
             </div>
             <div className="p-4 max-h-80 overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                   {expiryPopup.group.map(card => (
                      <div key={card.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 card-gradient rounded-lg flex items-center justify-center text-[8px] font-black text-white shrink-0">CARD</div>
                            <div>
                               <p className="text-sm font-black text-slate-900 dark:text-white leading-none mb-1">{card.name}</p>
                               <p className="text-[10px] text-slate-500 font-bold tracking-widest">ENDING IN {card.last4}</p>
                            </div>
                         </div>
                         <button onClick={() => { handleEditCard(card); setExpiryPopup(null); }} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                            <ChevronRight size={16} />
                         </button>
                      </div>
                   ))}
                </div>
             </div>
             <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <Info size={14} className="text-slate-400" />
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  Total of {expiryPopup.group.length} cards share this date.
                </p>
             </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-6 left-6 right-6 h-20 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-[2.5rem] px-8 flex justify-between items-center z-50 shadow-2xl">
        <button 
          onClick={() => setViewMode('Dashboard')} 
          className={`flex flex-col items-center transition-all ${viewMode === 'Dashboard' ? 'text-blue-400 scale-110' : 'text-slate-500'}`}
        >
          <LayoutGrid size={24} />
          <span className="text-[10px] font-black uppercase mt-1 tracking-widest">Wallet</span>
        </button>
        <button 
          onClick={() => setIsFormOpen(true)} 
          className="w-16 h-16 bg-blue-600 text-white rounded-2xl -mt-16 flex items-center justify-center border-[6px] border-slate-900 active:scale-90 shadow-2xl"
        >
          <Plus size={32} />
        </button>
        <button 
          onClick={() => setViewMode('Explorer')} 
          className={`flex flex-col items-center transition-all ${viewMode === 'Explorer' ? 'text-blue-400 scale-110' : 'text-slate-500'}`}
        >
          <Sparkles size={24} />
          <span className="text-[10px] font-black uppercase mt-1 tracking-widest">Benefits</span>
        </button>
      </nav>

      {isFormOpen && <CardForm onSave={handleSaveCard} onCancel={closeForm} initialData={editingCard} cards={cards} />}
      {isSettingsOpen && <SettingsModal cards={cards} onCardsSynced={onCardsSynced} onClose={() => setIsSettingsOpen(false)} masterKey={masterKey!} onNotifPeriodChange={handleNotifPeriodChange} />}
    </div>
  );
};

export default App;
