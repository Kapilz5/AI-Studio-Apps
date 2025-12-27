
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, LayoutGrid, ArrowUpDown, Wallet, Moon, Sun, UserCircle, Sparkles, CalendarDays, History, Layers, AlertTriangle, Search, X, ChevronRight, BarChart3, Info, TrendingUp, CreditCard as CardIcon } from 'lucide-react';
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
  const [notificationPeriod, setNotificationPeriodState] = useState(getNotificationPeriod());
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  
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
          icon: 'https://img.icons8.com/fluency/512/wallet.png'
        });
      }
    }
  }, [isAppLocked, cards, notificationPeriod]);

  const handleUnlockSuccess = useCallback((key: Uint8Array, decryptedCards?: CreditCard[]) => {
    setMasterKey(key);
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

  const totalFees = useMemo(() => cards.reduce((sum, c) => sum + c.annualFee, 0), [cards]);
  const totalLimit = useMemo(() => cards.reduce((sum, c) => sum + (c.creditLimit || 0), 0), [cards]);
  
  const expiringSoonCount = useMemo(() => {
    const now = new Date();
    return cards.filter(card => {
        const expiryDate = new Date(card.expiryYear, card.expiryMonth - 1);
        const diffMs = expiryDate.getTime() - now.getTime();
        const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
        return diffMonths > 0 && diffMonths <= notificationPeriod;
    }).length;
  }, [cards, notificationPeriod]);

  const furthestExpiryCard = useMemo(() => {
    if (cards.length === 0) return null;
    return [...cards].sort((a, b) => {
      if (a.expiryYear !== b.expiryYear) return b.expiryYear - a.expiryYear;
      return b.expiryMonth - a.expiryMonth;
    })[0];
  }, [cards]);

  const expiryConflicts = useMemo(() => {
    const groups: Record<string, CreditCard[]> = {};
    cards.forEach(card => {
      const key = `${card.expiryMonth}/${card.expiryYear}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    });
    return Object.entries(groups)
      .filter(([_, cluster]) => cluster.length > 1)
      .map(([date, cluster]) => ({ date, cluster }));
  }, [cards]);

  const handleHighlightCard = (id: string) => {
    setHighlightedCardId(id);
    setSearchTerm('');
    setTimeout(() => {
      const el = document.getElementById(`card-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedCardId(null), 3000);
    }, 100);
  };

  const sortedCards = useMemo(() => {
    let filtered = cards;
    if (searchTerm) {
      filtered = cards.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.last4.includes(searchTerm) ||
        c.cardType.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return [...filtered].sort((a, b) => {
      if (sortOrder === 'age') return Number(b.id) - Number(a.id); // Newest added first
      if (a.expiryYear !== b.expiryYear) return a.expiryYear - b.expiryYear;
      return a.expiryMonth - b.expiryMonth;
    });
  }, [cards, searchTerm, sortOrder]);

  if (isAppLocked || isSetupRequired) {
    return <SecurityAuth mode={isSetupRequired ? "setup" : "verify"} onSuccess={handleUnlockSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-32 md:pb-12 transition-colors duration-300">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 md:w-12 md:h-12 card-gradient rounded-2xl shadow-xl flex items-center justify-center text-white rotate-3">
              <Wallet size={24} />
            </div>
            <div className="hidden sm:block text-left">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1">My Cards</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">AI Secure Vault</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={() => setIsDark(!isDark)} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-200 dark:border-slate-800 active:scale-95">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-200 dark:border-slate-800 active:scale-95">
              <UserCircle size={18} />
            </button>
            <button onClick={() => setIsFormOpen(true)} className="flex items-center space-x-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 active:scale-95">
              <Plus size={20} /><span className="hidden sm:inline">Add Card</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {viewMode === 'Dashboard' ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Dashboard Overview Tabs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between group transition-all">
                <div>
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Layers size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vault Capacity</p>
                  <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">{cards.length} <span className="text-sm text-slate-400 font-bold tracking-normal">Cards</span></p>
                </div>
              </div>
              
              <div 
                onClick={() => expiryConflicts.length > 0 && setShowConflictModal(true)}
                className={`bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between relative transition-all ${expiryConflicts.length > 0 ? 'cursor-pointer hover:border-rose-300 dark:hover:border-rose-700 active:scale-95' : ''}`}
              >
                <div>
                  <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-xl flex items-center justify-center mb-3">
                    <AlertTriangle size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Near Expiry</p>
                  <div className="flex items-baseline gap-2">
                    <p className={`text-2xl md:text-3xl font-black ${expiringSoonCount > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>{expiringSoonCount}</p>
                    {expiryConflicts.length > 0 && (
                      <span className="flex items-center gap-1 bg-rose-100 dark:bg-rose-900/40 text-rose-600 text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">
                         CONFLICT
                      </span>
                    )}
                  </div>
                </div>
                {expiryConflicts.length > 0 && <div className="absolute top-4 right-6"><Info size={14} className="text-rose-400" /></div>}
              </div>

              <div 
                onClick={() => furthestExpiryCard && handleHighlightCard(furthestExpiryCard.id)}
                className={`bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between transition-all hover:border-purple-300 dark:hover:border-purple-700 cursor-pointer active:scale-95`}
              >
                <div>
                  <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/30 text-purple-600 rounded-xl flex items-center justify-center mb-3">
                    <History size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Furthest Expiry</p>
                  <div className="truncate">
                    <p className="text-lg md:text-xl font-black text-slate-900 dark:text-white truncate">
                      {furthestExpiryCard ? furthestExpiryCard.name : '--'}
                    </p>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Valid Until: {furthestExpiryCard ? `${String(furthestExpiryCard.expiryMonth).padStart(2, '0')}/${furthestExpiryCard.expiryYear}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
                    <BarChart3 size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Portfolio Limit</p>
                  <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">₹{totalLimit >= 100000 ? `${(totalLimit / 100000).toFixed(1)}L` : totalLimit.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div className="relative flex-grow max-w-md">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                 <input 
                  type="text" 
                  placeholder="Search vault or card ID..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                 />
               </div>
               <div className="flex gap-2">
                  <button onClick={() => setSortOrder(sortOrder === 'age' ? 'expiry' : 'age')} className="flex items-center space-x-2 px-6 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-black shadow-sm transition-all active:scale-95 uppercase tracking-widest">
                    <ArrowUpDown size={16} className="text-blue-600" />
                    <span>{sortOrder === 'age' ? 'Newest' : 'Expiry'}</span>
                  </button>
               </div>
            </div>

            {cards.length === 0 ? (
               <div className="py-20 text-center flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 transition-all">
                  <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mb-6">
                    <CardIcon size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Vault is Empty</h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-2 mb-8 font-medium">Add your cards to monitor expiry and annual fees.</p>
                  <button onClick={() => setIsFormOpen(true)} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/30 active:scale-95 transition-all">Add First Card</button>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {sortedCards.map(card => (
                  <div key={card.id} id={`card-${card.id}`} className={`transition-all duration-700 ${highlightedCardId === card.id ? 'ring-8 ring-purple-500/20 scale-105 z-20' : ''}`}>
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

      <nav className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <div className="max-w-md mx-auto mb-6 pointer-events-auto h-20 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-[2.5rem] px-8 flex justify-between items-center shadow-2xl">
          <button onClick={() => setViewMode('Dashboard')} className={`flex flex-col items-center transition-all active:scale-90 ${viewMode === 'Dashboard' ? 'text-blue-400 scale-110' : 'text-slate-500'}`}>
            <LayoutGrid size={24} />
            <span className="text-[9px] font-black uppercase mt-1 tracking-widest">Wallet</span>
          </button>
          <button onClick={() => setIsFormOpen(true)} className="w-16 h-16 bg-blue-600 text-white rounded-2xl -mt-16 flex items-center justify-center border-[6px] border-slate-900 shadow-2xl active:scale-90 transition-transform">
            <Plus size={32} />
          </button>
          <button onClick={() => setViewMode('Explorer')} className={`flex flex-col items-center transition-all active:scale-90 ${viewMode === 'Explorer' ? 'text-blue-400 scale-110' : 'text-slate-500'}`}>
            <Sparkles size={24} />
            <span className="text-[9px] font-black uppercase mt-1 tracking-widest">Insights</span>
          </button>
        </div>
      </nav>

      {/* EXPIRY CONFLICT MODAL */}
      {showConflictModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-300 border border-white/10 flex flex-col max-h-[80vh]">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none tracking-tight">Expiry Conflicts</h3>
                    <p className="text-[10px] text-rose-500 font-black uppercase tracking-widest mt-2">Managing Simultaneous Expiries</p>
                 </div>
                 <button onClick={() => setShowConflictModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors active:scale-90">
                    <X size={24} className="text-slate-400" />
                 </button>
              </div>
              <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
                 {expiryConflicts.map((conflict, i) => (
                    <div key={i} className="space-y-4">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-xl"><CalendarDays size={18} /></div>
                          <span className="text-lg font-black text-slate-900 dark:text-white">{conflict.date}</span>
                          <span className="px-3 py-1 bg-rose-50 dark:bg-rose-900/50 text-rose-600 text-[10px] font-black rounded-full uppercase tracking-widest">
                             {conflict.cluster.length} Cards
                          </span>
                       </div>
                       <div className="grid gap-3">
                          {conflict.cluster.map(card => (
                             <div key={card.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between group hover:border-blue-400 transition-all cursor-pointer" onClick={() => { handleHighlightCard(card.id); setShowConflictModal(false); }}>
                                <div className="flex items-center gap-3">
                                   <div className="w-10 h-7 bg-blue-600 rounded-md flex items-center justify-center text-[8px] font-black text-white uppercase tracking-tighter">
                                      {card.cardType || 'CARD'}
                                   </div>
                                   <div className="text-left">
                                      <p className="text-xs font-black text-slate-900 dark:text-white leading-none">{card.name}</p>
                                      <p className="text-[10px] text-slate-500 font-bold mt-1">•••• {card.last4}</p>
                                   </div>
                                </div>
                                <div className="p-2 text-slate-300 group-hover:text-blue-500 transition-colors">
                                   <ChevronRight size={16} />
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                 ))}
              </div>
              <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                 <button onClick={() => setShowConflictModal(false)} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 transition-all">Close Resolution View</button>
              </div>
           </div>
        </div>
      )}

      {isFormOpen && <CardForm onSave={handleSaveCard} onCancel={closeForm} initialData={editingCard} cards={cards} />}
      {isSettingsOpen && <SettingsModal cards={cards} onCardsSynced={(c) => setCards(c)} onClose={() => setIsSettingsOpen(false)} masterKey={masterKey!} onNotifPeriodChange={setNotificationPeriodState} />}
    </div>
  );
};

export default App;
