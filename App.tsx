
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, LayoutGrid, ArrowUpDown, Wallet, Moon, Sun, UserCircle, Sparkles, CalendarDays, History, Layers, AlertTriangle, Search, X, ChevronRight, BarChart3, Info, TrendingUp, CreditCard as CardIcon, Filter, CheckCircle2 } from 'lucide-react';
import { CreditCard, CardFormData, Benefit } from './types';
import { hasStoredData, getMPINHash, saveCards, decryptLocalCards, getNotificationPeriod } from './utils/storage';
import CardItem from './components/CardItem';
import CardForm from './components/CardForm';
import BenefitSearch from './components/BenefitSearch';
import SecurityAuth from './components/SecurityAuth';
import SettingsModal from './components/SettingsModal';
import { UI_STRINGS } from './locales/en';

type ViewMode = 'Dashboard' | 'Explorer';

const App: React.FC = () => {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>('Dashboard');
  const [sortOrder, setSortOrder] = useState<'age' | 'expiry' | 'limit'>('age');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterExpiring, setFilterExpiring] = useState(false);
  const [notificationPeriod, setNotificationPeriodState] = useState(getNotificationPeriod());
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  
  const [isAppLocked, setIsAppLocked] = useState(true);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);
  
  // Use a ref to track current unlocked state for the visibility listener
  const isUnlockedRef = useRef(false);

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Handle Theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Initial Security Check & Session Lock on App Visibility Change
  useEffect(() => {
    const checkSecurityStatus = () => {
      const pinHash = getMPINHash();
      if (!pinHash) {
        setIsSetupRequired(true);
        setIsAppLocked(false);
      } else {
        setIsAppLocked(true);
      }
    };

    checkSecurityStatus();

    const handleVisibilityChange = () => {
      // ONLY trigger lock if the app was previously unlocked and has a key in memory.
      // If document becomes hidden and we have a session, we clear it.
      if (document.visibilityState === 'hidden' && isUnlockedRef.current) {
        setIsAppLocked(true);
        setMasterKey(null);
        isUnlockedRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleUnlockSuccess = useCallback((key: Uint8Array, decryptedCards?: CreditCard[]) => {
    setMasterKey(key);
    isUnlockedRef.current = true;
    if (decryptedCards) setCards(decryptedCards);
    setIsAppLocked(false);
    setIsSetupRequired(false);
  }, []);

  const handleSaveCard = async (data: CardFormData, benefits: Benefit[]) => {
    if (!masterKey) return;
    let updatedCards: CreditCard[];
    if (editingCard) {
      updatedCards = cards.map(c => c.id === editingCard.id ? { ...c, ...data, benefits } : c);
    } else {
      const newCard: CreditCard = { ...data, id: Date.now().toString(), benefits };
      updatedCards = [...cards, newCard];
    }
    setCards(updatedCards);
    await saveCards(updatedCards, masterKey);
    closeForm();
  };

  const closeForm = () => { setIsFormOpen(false); setEditingCard(undefined); };

  const handleUpdateSpend = async (id: string, additionalAmount: number) => {
    if (!masterKey) return;
    const updated = cards.map(card => card.id === id ? { ...card, currentSpend: card.currentSpend + additionalAmount } : card);
    setCards(updated);
    await saveCards(updated, masterKey);
  };

  const handleDeleteCard = async (id: string) => {
    if (!masterKey) return;
    const updated = cards.filter(c => c.id !== id);
    setCards(updated);
    await saveCards(updated, masterKey);
  };

  const handleEditCard = (card: CreditCard) => { setEditingCard(card); setIsFormOpen(true); };

  const totalLimit = useMemo(() => cards.reduce((sum, c) => sum + (Number(c.creditLimit) || 0), 0), [cards]);
  const totalFees = useMemo(() => cards.reduce((sum, c) => sum + (Number(c.annualFee) || 0), 0), [cards]);

  const expiringSoonCount = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    return cards.filter(card => {
        const monthDiff = (card.expiryYear - currentYear) * 12 + (card.expiryMonth - currentMonth);
        return monthDiff >= 0 && monthDiff <= notificationPeriod;
    }).length;
  }, [cards, notificationPeriod]);

  const furthestExpiryCard = useMemo(() => {
    if (cards.length === 0) return null;
    return [...cards].sort((a, b) => {
      if (a.expiryYear !== b.expiryYear) return b.expiryYear - a.expiryYear;
      return b.expiryMonth - a.expiryMonth;
    })[0];
  }, [cards]);

  const sortedCards = useMemo(() => {
    let filtered = cards;
    
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.last4.includes(searchTerm) ||
        (c.cardType && c.cardType.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    if (filterExpiring) {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      filtered = filtered.filter(card => {
        const monthDiff = (card.expiryYear - currentYear) * 12 + (card.expiryMonth - currentMonth);
        return monthDiff >= 0 && monthDiff <= notificationPeriod;
      });
    }

    return [...filtered].sort((a, b) => {
      if (sortOrder === 'limit') return (Number(b.creditLimit) || 0) - (Number(a.creditLimit) || 0);
      if (sortOrder === 'expiry') {
        if (a.expiryYear !== b.expiryYear) return a.expiryYear - b.expiryYear;
        return a.expiryMonth - b.expiryMonth;
      }
      return Number(b.id) - Number(a.id);
    });
  }, [cards, searchTerm, sortOrder, filterExpiring, notificationPeriod]);

  const handleHighlightCard = (id: string) => {
    setHighlightedCardId(id);
    setSearchTerm('');
    setFilterExpiring(false);
    setTimeout(() => {
      const el = document.getElementById(`card-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedCardId(null), 3000);
    }, 100);
  };

  if (isAppLocked || isSetupRequired) {
    return <SecurityAuth mode={isSetupRequired ? "setup" : "verify"} onSuccess={handleUnlockSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-20 transition-colors duration-300">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 md:h-24 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-10 h-10 md:w-12 md:h-12 card-gradient rounded-2xl shadow-xl flex items-center justify-center text-white rotate-3">
              <Wallet size={24} />
            </div>
            <div className="hidden sm:block text-left">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1">{UI_STRINGS.common.app_name}</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none">Personal Finance Vault</p>
            </div>
          </div>

          <div className="flex-grow max-w-xs md:max-w-sm">
             <div className="bg-slate-200/50 dark:bg-slate-800/80 p-1 rounded-2xl flex relative h-11 md:h-12 shadow-inner border border-slate-300/20 dark:border-slate-700/50">
                <div 
                  className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-slate-600 rounded-xl shadow-md transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${viewMode === 'Explorer' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`}
                />
                <button 
                  onClick={() => setViewMode('Dashboard')}
                  className={`flex-1 flex items-center justify-center gap-2 relative z-10 transition-colors duration-300 ${viewMode === 'Dashboard' ? 'text-blue-600 dark:text-white font-black' : 'text-slate-500 font-bold'}`}
                >
                  <LayoutGrid size={18} />
                  <span className="text-[10px] uppercase tracking-widest hidden md:inline">Wallet</span>
                </button>
                <button 
                  onClick={() => setViewMode('Explorer')}
                  className={`flex-1 flex items-center justify-center gap-2 relative z-10 transition-colors duration-300 ${viewMode === 'Explorer' ? 'text-blue-600 dark:text-white font-black' : 'text-slate-500 font-bold'}`}
                >
                  <Sparkles size={18} />
                  <span className="text-[10px] uppercase tracking-widest hidden md:inline">Benefits</span>
                </button>
             </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button onClick={() => setIsDark(!isDark)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-all border border-slate-200 dark:border-slate-800 active:scale-95">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl transition-all border border-slate-200 dark:border-slate-800 active:scale-95">
              <UserCircle size={18} />
            </button>
            <button onClick={() => setIsFormOpen(true)} className="p-2.5 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 active:scale-95">
              <Plus size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {viewMode === 'Dashboard' ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div 
                onClick={() => { setFilterExpiring(false); setSortOrder('age'); }}
                className={`p-6 rounded-[2.5rem] shadow-sm border flex flex-col justify-between group transition-all cursor-pointer active:scale-95 ${!filterExpiring && sortOrder === 'age' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ring-2 ring-blue-500/10' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
              >
                <div>
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                    <Layers size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vault Capacity</p>
                  <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{cards.length} <span className="text-sm text-slate-400 font-bold tracking-normal">Cards</span></p>
                </div>
              </div>
              
              <div 
                onClick={() => expiringSoonCount > 0 && setFilterExpiring(!filterExpiring)}
                className={`p-6 rounded-[2.5rem] shadow-sm border flex flex-col justify-between relative transition-all active:scale-95 ${filterExpiring ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-500 ring-2 ring-rose-500/10' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'} ${expiringSoonCount > 0 ? 'cursor-pointer hover:border-rose-300 dark:hover:border-rose-700' : 'opacity-60'}`}
              >
                <div>
                  <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-rose-500/20">
                    <AlertTriangle size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Near Expiry</p>
                  <div className="flex items-baseline gap-2">
                    <p className={`text-2xl md:text-3xl font-black ${expiringSoonCount > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>{expiringSoonCount}</p>
                    {expiringSoonCount > 0 && (
                      <span className="flex items-center gap-1 bg-rose-100 dark:bg-rose-900/40 text-rose-600 text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">
                         ALERT
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div 
                onClick={() => furthestExpiryCard && handleHighlightCard(furthestExpiryCard.id)}
                className={`p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between transition-all hover:border-purple-300 dark:hover:border-purple-700 cursor-pointer active:scale-95`}
              >
                <div>
                  <div className="w-10 h-10 bg-purple-500 text-white rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-purple-500/20">
                    <History size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Furthest Expiry</p>
                  <div className="truncate">
                    <p className="text-lg md:text-xl font-black text-slate-900 dark:text-white truncate">
                      {furthestExpiryCard ? furthestExpiryCard.name : '--'}
                    </p>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mt-1">
                      VALID UNTIL: {furthestExpiryCard ? `${String(furthestExpiryCard.expiryMonth).padStart(2, '0')}/${furthestExpiryCard.expiryYear}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => totalLimit > 0 && setSortOrder('limit')}
                className={`p-6 rounded-[2.5rem] shadow-sm border flex flex-col justify-between transition-all active:scale-95 ${sortOrder === 'limit' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 ring-2 ring-emerald-500/10' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
              >
                <div>
                  <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20">
                    <BarChart3 size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Portfolio Limit</p>
                  <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">₹{totalLimit >= 100000 ? `${(totalLimit / 100000).toFixed(1)}L` : totalLimit.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="relative flex-grow max-w-xl">
                 <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                 <input 
                  type="text" 
                  placeholder="Search cards, last 4 digits, or bank..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full pl-14 pr-6 py-5 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-slate-700 dark:text-slate-200" 
                 />
                 {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-5 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400"><X size={16} /></button>}
               </div>
               <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      const nextSort = sortOrder === 'age' ? 'expiry' : sortOrder === 'expiry' ? 'limit' : 'age';
                      setSortOrder(nextSort);
                    }}
                    className="flex items-center gap-2 px-6 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95"
                  >
                    <ArrowUpDown size={16} className="text-blue-500" />
                    <span>Sorted by: {sortOrder === 'age' ? 'Newest' : sortOrder === 'expiry' ? 'Expiry' : 'Limit'}</span>
                  </button>
                  {filterExpiring && (
                    <button 
                      onClick={() => setFilterExpiring(false)}
                      className="flex items-center gap-2 px-6 py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-rose-500/30 transition-all active:scale-95"
                    >
                      <X size={16} />
                      <span>Clear Expiry Filter</span>
                    </button>
                  )}
               </div>
            </div>

            {sortedCards.length === 0 ? (
               <div className="py-24 text-center flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 shadow-inner">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800/50 text-slate-300 rounded-full flex items-center justify-center mb-6">
                    {filterExpiring ? <AlertTriangle size={48} /> : <CardIcon size={48} />}
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {filterExpiring ? 'No Expiring Cards' : 'Your Vault is Clean'}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-2 mb-8 font-medium max-w-xs mx-auto text-sm">
                    {filterExpiring ? 'Currently no cards match the near-expiry threshold.' : 'Start your secure card collection by adding your first credit or debit card.'}
                  </p>
                  <div className="flex gap-4">
                    {filterExpiring && <button onClick={() => setFilterExpiring(false)} className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">View All</button>}
                    <button onClick={() => setIsFormOpen(true)} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-500/30 active:scale-95 transition-all">
                      Add Card
                    </button>
                  </div>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {sortedCards.map(card => (
                  <div key={card.id} id={`card-${card.id}`} className={`transition-all duration-700 ${highlightedCardId === card.id ? 'ring-8 ring-purple-500/20 scale-105 z-20 rounded-[2.5rem]' : ''}`}>
                    <CardItem card={card} onDelete={handleDeleteCard} onEdit={handleEditCard} onUpdateSpend={handleUpdateSpend} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <BenefitSearch cards={cards} />
        )}
      </main>

      {/* Security Hint */}
      {cards.length > 0 && viewMode === 'Dashboard' && !isAppLocked && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
           <div className="bg-slate-900/90 dark:bg-blue-600/90 text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl backdrop-blur-md border border-white/10 animate-in slide-in-from-bottom-10 duration-700">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Vault Secured with Local AES-256</span>
           </div>
        </div>
      )}

      {isFormOpen && <CardForm onSave={handleSaveCard} onCancel={closeForm} initialData={editingCard} cards={cards} />}
      {isSettingsOpen && <SettingsModal cards={cards} onCardsSynced={(c) => setCards(c)} onClose={() => setIsSettingsOpen(false)} masterKey={masterKey!} onNotifPeriodChange={setNotificationPeriodState} />}
    </div>
  );
};

export default App;
