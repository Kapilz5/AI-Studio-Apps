
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
          icon: 'https://cdn-icons-png.flaticon.com/512/9334/9334530.png'
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

  const sortedCards = useMemo(() => {
    let filtered = cards;
    if (searchTerm) {
      filtered = cards.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.last4.includes(searchTerm));
    }
    return [...filtered].sort((a, b) => {
      if (sortOrder === 'age') return Number(a.id) - Number(b.id);
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
            <div className="hidden sm:block">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1">My Cards</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Secure Vault</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={() => setIsDark(!isDark)} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-200 dark:border-slate-800">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-200 dark:border-slate-800">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Portfolio Value</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">₹{totalLimit.toLocaleString()}</p>
                <div className="mt-4 flex items-center gap-2 text-emerald-500 font-bold text-[10px] uppercase">
                  <TrendingUp size={12} /> <span>Credit Power</span>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Annual Maintenance</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white">₹{totalFees.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div className="relative flex-grow max-w-md">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                 <input type="text" placeholder="Search cards..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" />
               </div>
               <button onClick={() => setSortOrder(sortOrder === 'age' ? 'expiry' : 'age')} className="flex items-center space-x-2 px-6 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-black shadow-sm">
                  <ArrowUpDown size={18} className="text-blue-600" />
                  <span>{sortOrder === 'age' ? 'By Age' : 'By Expiry'}</span>
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {sortedCards.map(card => (
                <CardItem key={card.id} card={card} onDelete={handleDeleteCard} onEdit={handleEditCard} onUpdateSpend={handleUpdateSpend} />
              ))}
            </div>
          </div>
        ) : (
          <BenefitSearch cards={cards} />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 px-6 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <div className="max-w-md mx-auto mb-6 pointer-events-auto h-20 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-[2.5rem] px-8 flex justify-between items-center shadow-2xl">
          <button onClick={() => setViewMode('Dashboard')} className={`flex flex-col items-center transition-all ${viewMode === 'Dashboard' ? 'text-blue-400' : 'text-slate-500'}`}>
            <LayoutGrid size={24} />
            <span className="text-[9px] font-black uppercase mt-1 tracking-widest">Wallet</span>
          </button>
          <button onClick={() => setIsFormOpen(true)} className="w-16 h-16 bg-blue-600 text-white rounded-2xl -mt-16 flex items-center justify-center border-[6px] border-slate-900 shadow-2xl active:scale-90 transition-transform">
            <Plus size={32} />
          </button>
          <button onClick={() => setViewMode('Explorer')} className={`flex flex-col items-center transition-all ${viewMode === 'Explorer' ? 'text-blue-400' : 'text-slate-500'}`}>
            <Sparkles size={24} />
            <span className="text-[9px] font-black uppercase mt-1 tracking-widest">Explorer</span>
          </button>
        </div>
      </nav>

      {isFormOpen && <CardForm onSave={handleSaveCard} onCancel={closeForm} initialData={editingCard} cards={cards} />}
      {isSettingsOpen && <SettingsModal cards={cards} onCardsSynced={(c) => setCards(c)} onClose={() => setIsSettingsOpen(false)} masterKey={masterKey!} onNotifPeriodChange={setNotificationPeriodState} />}
    </div>
  );
};

export default App;
