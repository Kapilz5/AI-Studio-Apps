
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, LayoutGrid, ArrowUpDown, Wallet, Moon, Sun, UserCircle, Sparkles, CalendarDays, History, Layers, AlertTriangle, Search, X, ChevronRight, BarChart3, Info, TrendingUp, CreditCard as CardIcon, Filter, CheckCircle2, Lightbulb, ChevronDown } from 'lucide-react';
import { CreditCard, CardFormData, Benefit } from './types';
import { hasStoredData, getMPINHash, saveCards, decryptLocalCards, getNotificationPeriod, removeNotifiedFlag, getLastSeenVersion, setLastSeenVersion, APP_VERSION } from './utils/storage';
import CardItem from './components/CardItem';
import CardForm from './components/CardForm';
import BenefitSearch from './components/BenefitSearch';
import SecurityAuth from './components/SecurityAuth';
import SettingsModal from './components/SettingsModal';
import CardAdvisor from './components/CardAdvisor';
import { UI_STRINGS } from './locales/en';
import { checkAndNotifyForExpiringCards } from './utils/notifications';

type ViewMode = 'Dashboard' | 'Explorer' | 'Advisor';
type ActiveFilter = 'none' | 'near' | 'furthest';

const INACTIVITY_TIMEOUT_MS = 60 * 1000; // 60 seconds inactivity timeout

const App: React.FC = () => {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>('Dashboard');
  const [sortOrder, setSortOrder] = useState<'age' | 'expiry' | 'limit'>('age');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('none');
  const [notificationPeriod, setNotificationPeriodState] = useState(2);
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const [showExpiredSection, setShowExpiredSection] = useState(false);
  
  const [isAppLocked, setIsAppLocked] = useState(true);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  
  const isUnlockedRef = useRef(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Lock app function
  const lockApp = useCallback(() => {
    if (isUnlockedRef.current) {
      setIsAppLocked(true);
      setMasterKey(null);
      isUnlockedRef.current = false;
      setIsFormOpen(false);
      setIsSettingsOpen(false);
    }
  }, []);

  // Inactivity Timer Logic
  useEffect(() => {
    const resetTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (!isAppLocked && isUnlockedRef.current) {
        inactivityTimerRef.current = setTimeout(() => {
          lockApp();
        }, INACTIVITY_TIMEOUT_MS);
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    
    if (!isAppLocked) {
      resetTimer();
      events.forEach(e => document.addEventListener(e, resetTimer));
    }

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [isAppLocked, lockApp]);

  useEffect(() => {
    const initApp = async () => {
      try {
        const pinHash = await getMPINHash();
        const notifPeriod = await getNotificationPeriod();
        
        setNotificationPeriodState(notifPeriod);
        
        if (!pinHash) {
          setIsSetupRequired(true);
          setIsAppLocked(false);
        } else {
          setIsAppLocked(true);
        }
      } catch (e) {
        console.error("Storage init failed:", e);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lockApp();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lockApp]);

  // Effect to run notification checks and version check when app is unlocked
  useEffect(() => {
    if (!isAppLocked && masterKey) {
        checkAndNotifyForExpiringCards(cards.filter(c => c.status !== 'expired'), notificationPeriod);

        // Check for updates
        const checkVersion = async () => {
          const lastVersion = await getLastSeenVersion();
          if (lastVersion !== APP_VERSION) {
            setShowUpdateToast(true);
            await setLastSeenVersion(APP_VERSION);
            // Auto dismiss toast
            setTimeout(() => setShowUpdateToast(false), 5000);
          }
        };
        checkVersion();
    }
  }, [cards, notificationPeriod, isAppLocked, masterKey]);

  const handleUnlockSuccess = useCallback((key: Uint8Array, decryptedCards?: CreditCard[]) => {
    setMasterKey(key);
    isUnlockedRef.current = true;
    
    if (decryptedCards) {
        // Automatic Expiry Transition Check on Unlock
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        let hasChanges = false;

        const processedCards = decryptedCards.map(c => {
            // Ensure status property exists for legacy cards
            const currentStatus = c.status || 'active';
            
            if (currentStatus === 'expired') return { ...c, status: 'expired' as const };

            // Check if it has crossed expiry date
            const isExpiredDate = c.expiryYear < currentYear || (c.expiryYear === currentYear && c.expiryMonth < currentMonth);
            
            if (isExpiredDate) {
                hasChanges = true;
                return { ...c, status: 'expired' as const };
            }
            return { ...c, status: currentStatus };
        });

        setCards(processedCards);
        
        if (hasChanges) {
            saveCards(processedCards, key);
        }
    }
    
    setIsAppLocked(false);
    setIsSetupRequired(false);
  }, []);

  const handleSaveCard = async (data: CardFormData, benefits: Benefit[]) => {
    if (!masterKey) return;
    let updatedCards: CreditCard[];

    if (editingCard) {
      // If expiry date changed, reset the notification flag for this card
      if (editingCard.expiryMonth !== data.expiryMonth || editingCard.expiryYear !== data.expiryYear) {
        await removeNotifiedFlag(editingCard.id);
      }
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
    // Remove any notification flags for the deleted card
    await removeNotifiedFlag(id);
  };

  const handleEditCard = (card: CreditCard) => { setEditingCard(card); setIsFormOpen(true); };

  // Computed lists
  const activeCards = useMemo(() => cards.filter(c => c.status !== 'expired'), [cards]);
  const expiredCards = useMemo(() => cards.filter(c => c.status === 'expired'), [cards]);

  const totalLimit = useMemo(() => activeCards.reduce((sum, c) => sum + (Number(c.creditLimit) || 0), 0), [activeCards]);

  const nearExpiryInfo = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const matches = activeCards.filter(card => {
        const monthDiff = (card.expiryYear - currentYear) * 12 + (card.expiryMonth - currentMonth);
        return monthDiff >= 0 && monthDiff <= notificationPeriod;
    });

    return {
      count: matches.length,
      sampleName: matches.length === 1 ? matches[0].name : null,
      cards: matches
    };
  }, [activeCards, notificationPeriod]);

  const furthestExpiryInfo = useMemo(() => {
    if (activeCards.length === 0) return null;
    const sorted = [...activeCards].sort((a, b) => {
      if (a.expiryYear !== b.expiryYear) return b.expiryYear - a.expiryYear;
      return b.expiryMonth - a.expiryMonth;
    });
    
    const maxCard = sorted[0];
    const tiedCards = activeCards.filter(c => c.expiryYear === maxCard.expiryYear && c.expiryMonth === maxCard.expiryMonth);
    
    return {
      count: tiedCards.length,
      sampleName: tiedCards.length === 1 ? maxCard.name : null,
      month: maxCard.expiryMonth,
      year: maxCard.expiryYear,
      sampleId: maxCard.id,
      cards: tiedCards
    };
  }, [activeCards]);

  const sortedActiveCards = useMemo(() => {
    let filtered = activeCards;
    
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.last4.includes(searchTerm) ||
        (c.cardType && c.cardType.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    if (activeFilter === 'near') {
      filtered = nearExpiryInfo.cards;
    } else if (activeFilter === 'furthest' && furthestExpiryInfo) {
      filtered = furthestExpiryInfo.cards;
    }

    return [...filtered].sort((a, b) => {
      if (sortOrder === 'limit') return (Number(b.creditLimit) || 0) - (Number(a.creditLimit) || 0);
      if (sortOrder === 'expiry') {
        if (a.expiryYear !== b.expiryYear) return a.expiryYear - b.expiryYear;
        return a.expiryMonth - b.expiryMonth;
      }
      return Number(b.id) - Number(a.id);
    });
  }, [activeCards, searchTerm, sortOrder, activeFilter, nearExpiryInfo, furthestExpiryInfo]);

  const sortedExpiredCards = useMemo(() => {
      // Always sort expired cards by date (most recently expired first)
      return [...expiredCards].sort((a, b) => {
          if (a.expiryYear !== b.expiryYear) return b.expiryYear - a.expiryYear;
          return b.expiryMonth - a.expiryMonth;
      });
  }, [expiredCards]);

  const toggleFilter = (filter: ActiveFilter) => {
    setActiveFilter(prev => prev === filter ? 'none' : filter);
  };

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div></div>;
  }

  if (isAppLocked || isSetupRequired) {
    return <SecurityAuth mode={isSetupRequired ? "setup" : "verify"} onSuccess={handleUnlockSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-20 transition-colors duration-300 relative selection:bg-blue-200 dark:selection:bg-blue-900">
      
      {/* Dynamic Background Aura */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full bg-blue-400/20 dark:bg-blue-600/10 blur-[120px] animate-pulse-slow mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-400/20 dark:bg-purple-600/10 blur-[120px] animate-pulse-slow delay-1000 mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute top-[30%] left-[30%] w-[40vw] h-[40vw] rounded-full bg-indigo-300/10 dark:bg-indigo-500/5 blur-[100px] animate-pulse-slow delay-500" />
      </div>

      <header className="sticky top-0 z-40 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 pt-[env(safe-area-inset-top)] transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 md:h-24 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 shrink-0 group cursor-default">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center text-white rotate-3 group-hover:rotate-6 transition-transform duration-300 border border-white/20">
              <Wallet size={24} />
            </div>
            <div className="hidden sm:block text-left">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1">{UI_STRINGS.common.app_name}</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none">Personal Finance Vault</p>
            </div>
          </div>

          <div className="flex-grow max-w-[20rem] md:max-w-lg">
             <div className="bg-slate-200/50 dark:bg-slate-800/80 p-1.5 rounded-full flex relative h-12 shadow-inner border border-slate-300/20 dark:border-slate-700/50 backdrop-blur-md">
                <div 
                  className={`absolute top-1.5 bottom-1.5 w-[calc(33.33%-6px)] bg-white dark:bg-slate-600 rounded-full shadow-lg shadow-black/5 transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${
                    viewMode === 'Dashboard' ? 'translate-x-0' : 
                    viewMode === 'Explorer' ? 'translate-x-[calc(100%+6px)]' : 
                    'translate-x-[calc(200%+12px)]'
                  }`}
                />
                <button 
                  onClick={() => setViewMode('Dashboard')}
                  className={`flex-1 flex items-center justify-center gap-2 relative z-10 transition-colors duration-300 ${viewMode === 'Dashboard' ? 'text-blue-600 dark:text-white font-black' : 'text-slate-500 font-bold hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  <LayoutGrid size={18} />
                  <span className="text-[10px] uppercase tracking-widest hidden md:inline">{UI_STRINGS.navigation.wallet}</span>
                </button>
                <button 
                  onClick={() => setViewMode('Explorer')}
                  className={`flex-1 flex items-center justify-center gap-2 relative z-10 transition-colors duration-300 ${viewMode === 'Explorer' ? 'text-blue-600 dark:text-white font-black' : 'text-slate-500 font-bold hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  <Sparkles size={18} />
                  <span className="text-[10px] uppercase tracking-widest hidden md:inline">{UI_STRINGS.navigation.benefits}</span>
                </button>
                <button 
                  onClick={() => setViewMode('Advisor')}
                  className={`flex-1 flex items-center justify-center gap-2 relative z-10 transition-colors duration-300 ${viewMode === 'Advisor' ? 'text-blue-600 dark:text-white font-black' : 'text-slate-500 font-bold hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  <Lightbulb size={18} />
                  <span className="text-[10px] uppercase tracking-widest hidden md:inline">{UI_STRINGS.navigation.advisor}</span>
                </button>
             </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button onClick={() => setIsDark(!isDark)} className="p-3 bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-200 dark:border-slate-700 active:scale-95 hover:bg-white dark:hover:bg-slate-700 shadow-sm backdrop-blur-md">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-2xl transition-all border border-slate-200 dark:border-slate-700 active:scale-95 hover:bg-white dark:hover:bg-slate-700 shadow-sm backdrop-blur-md">
              <UserCircle size={18} />
            </button>
            <button onClick={() => setIsFormOpen(true)} className="p-3 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/30 active:scale-95 hover:scale-105 border border-white/20">
              <Plus size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 relative z-10">
        {viewMode === 'Dashboard' ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Stats Grid - Glassmorphism */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div 
                onClick={() => { setActiveFilter('none'); setSortOrder('age'); }}
                className={`p-6 rounded-[2.5rem] flex flex-col justify-between group transition-all duration-300 cursor-pointer active:scale-95 hover:-translate-y-1 ${activeFilter === 'none' && sortOrder === 'age' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl shadow-blue-500/30 border-transparent' : 'bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-white/20 dark:border-slate-700 shadow-sm hover:shadow-lg'}`}
              >
                <div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-500 group-hover:rotate-12 ${activeFilter === 'none' && sortOrder === 'age' ? 'bg-white/20 text-white' : 'bg-blue-50 dark:bg-slate-700 text-blue-500'}`}>
                    <Layers size={24} />
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${activeFilter === 'none' && sortOrder === 'age' ? 'text-blue-100' : 'text-slate-400'}`}>Active Vault</p>
                  <p className={`text-3xl md:text-4xl font-black ${activeFilter === 'none' && sortOrder === 'age' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{activeCards.length}</p>
                </div>
              </div>
              
              <div 
                onClick={() => nearExpiryInfo.count > 0 && toggleFilter('near')}
                className={`p-6 rounded-[2.5rem] flex flex-col justify-between group transition-all duration-300 active:scale-95 hover:-translate-y-1 ${activeFilter === 'near' ? 'bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-xl shadow-rose-500/30 border-transparent' : 'bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-white/20 dark:border-slate-700 shadow-sm hover:shadow-lg'} ${nearExpiryInfo.count > 0 ? 'cursor-pointer' : 'opacity-60 grayscale'}`}
              >
                <div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-500 group-hover:rotate-12 ${activeFilter === 'near' ? 'bg-white/20 text-white' : 'bg-rose-50 dark:bg-slate-700 text-rose-500'}`}>
                    <AlertTriangle size={24} />
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${activeFilter === 'near' ? 'text-rose-100' : 'text-slate-400'}`}>Near Expiry</p>
                  <div className="truncate">
                    <p className={`text-xl md:text-2xl font-black truncate ${activeFilter === 'near' ? 'text-white' : nearExpiryInfo.count > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                      {nearExpiryInfo.sampleName || (nearExpiryInfo.count > 0 ? `${nearExpiryInfo.count} Cards` : 'None')}
                    </p>
                    {nearExpiryInfo.count > 0 && (
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${activeFilter === 'near' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'}`}>
                         CRITICAL
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div 
                onClick={() => furthestExpiryInfo && toggleFilter('furthest')}
                className={`p-6 rounded-[2.5rem] flex flex-col justify-between group transition-all duration-300 active:scale-95 hover:-translate-y-1 ${activeFilter === 'furthest' ? 'bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white shadow-xl shadow-purple-500/30 border-transparent' : 'bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-white/20 dark:border-slate-700 shadow-sm hover:shadow-lg'} ${furthestExpiryInfo ? 'cursor-pointer' : 'opacity-60'}`}
              >
                <div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-500 group-hover:rotate-12 ${activeFilter === 'furthest' ? 'bg-white/20 text-white' : 'bg-purple-50 dark:bg-slate-700 text-purple-500'}`}>
                    <History size={24} />
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${activeFilter === 'furthest' ? 'text-purple-100' : 'text-slate-400'}`}>Furthest Expiry</p>
                  <div className="truncate">
                    <p className={`text-lg md:text-xl font-black truncate ${activeFilter === 'furthest' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                      {furthestExpiryInfo 
                        ? (furthestExpiryInfo.sampleName || `${furthestExpiryInfo.count} Cards`) 
                        : '--'}
                    </p>
                    <p className={`text-[9px] font-black uppercase tracking-widest leading-none mt-2 ${activeFilter === 'furthest' ? 'text-purple-200' : 'text-slate-500'}`}>
                      VALID UNTIL: {furthestExpiryInfo ? `${String(furthestExpiryInfo.month).padStart(2, '0')}/${furthestExpiryInfo.year}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => totalLimit > 0 && setSortOrder('limit')}
                className={`p-6 rounded-[2.5rem] flex flex-col justify-between group transition-all duration-300 active:scale-95 hover:-translate-y-1 ${sortOrder === 'limit' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/30 border-transparent' : 'bg-white/60 dark:bg-slate-800/40 backdrop-blur-lg border border-white/20 dark:border-slate-700 shadow-sm hover:shadow-lg'}`}
              >
                <div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-500 group-hover:rotate-12 ${sortOrder === 'limit' ? 'bg-white/20 text-white' : 'bg-emerald-50 dark:bg-slate-700 text-emerald-500'}`}>
                    <BarChart3 size={24} />
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${sortOrder === 'limit' ? 'text-emerald-100' : 'text-slate-400'}`}>Active Limit</p>
                  <p className={`text-2xl md:text-3xl font-black ${sortOrder === 'limit' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>₹{totalLimit >= 100000 ? `${(totalLimit / 100000).toFixed(1)}L` : totalLimit.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="relative flex-grow max-w-xl group">
                 <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                 <input 
                  type="text" 
                  placeholder="Search cards, last 4 digits, or bank..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full pl-14 pr-6 py-5 rounded-full bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-slate-700 dark:text-slate-200 backdrop-blur-md" 
                 />
                 {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-5 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400"><X size={16} /></button>}
               </div>
               <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      const nextSort = sortOrder === 'age' ? 'expiry' : sortOrder === 'expiry' ? 'limit' : 'age';
                      setSortOrder(nextSort);
                    }}
                    className="flex items-center gap-2 px-6 py-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 hover:border-blue-400 dark:hover:border-blue-500"
                  >
                    <ArrowUpDown size={16} className="text-blue-500" />
                    <span>Sorted by: {sortOrder === 'age' ? 'Newest' : sortOrder === 'expiry' ? 'Expiry' : 'Limit'}</span>
                  </button>
                  {activeFilter !== 'none' && (
                    <button 
                      onClick={() => setActiveFilter('none')}
                      className="flex items-center gap-2 px-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95"
                    >
                      <X size={16} />
                      <span>Clear Filter: {activeFilter}</span>
                    </button>
                  )}
               </div>
            </div>

            {/* Active Cards Section */}
            <div>
               <div className="flex items-center justify-between mb-6 px-2">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
                     <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">Active Cards</span>
                     <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-xs text-slate-500 font-bold">{sortedActiveCards.length}</span>
                  </h3>
               </div>

               {sortedActiveCards.length === 0 && activeFilter === 'none' && !searchTerm ? (
                  <div className="py-20 text-center flex flex-col items-center justify-center bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-[3rem] border border-dashed border-slate-300 dark:border-slate-700">
                      <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/20 rotate-3">
                        <Wallet size={40} className="text-white" />
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Vault is Empty</h3>
                      <p className="text-slate-500 dark:text-slate-400 mt-2 mb-8 font-medium max-w-xs mx-auto text-sm leading-relaxed">
                        Add your first card to start monitoring fees, expiry, and benefits.
                      </p>
                      <button onClick={() => setIsFormOpen(true)} className="px-10 py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl hover:shadow-xl hover:-translate-y-1 active:scale-95 transition-all">
                        Add First Card
                      </button>
                  </div>
               ) : sortedActiveCards.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center justify-center opacity-50">
                     <Search size={40} className="text-slate-400 mb-4" />
                     <p className="text-slate-400 font-bold">No active cards match criteria.</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 perspective-1000">
                    {sortedActiveCards.map(card => (
                      <div key={card.id} id={`card-${card.id}`} className={`transition-all duration-700 ${highlightedCardId === card.id ? 'ring-8 ring-purple-500/20 scale-105 z-20 rounded-[2.5rem]' : ''}`}>
                        <CardItem 
                          card={card} 
                          onDelete={handleDeleteCard} 
                          onEdit={handleEditCard} 
                          onUpdateSpend={handleUpdateSpend}
                          notificationPeriod={notificationPeriod} 
                        />
                      </div>
                    ))}
                  </div>
               )}
            </div>

            {/* Expired Cards Section */}
            {expiredCards.length > 0 && (
                <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-10">
                    <button 
                        onClick={() => setShowExpiredSection(!showExpiredSection)}
                        className="w-full flex items-center justify-between mb-8 group p-4 rounded-3xl hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                        <h3 className="text-lg font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest flex items-center gap-3 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">
                            <span>Expired Cards</span>
                            <span className="bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded-full text-xs text-slate-500 dark:text-slate-500">{expiredCards.length}</span>
                        </h3>
                        <div className={`w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 transition-transform duration-300 ${showExpiredSection ? 'rotate-180' : ''}`}>
                            <ChevronDown size={20} />
                        </div>
                    </button>
                    
                    {showExpiredSection && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in slide-in-from-top-8 duration-500">
                            {sortedExpiredCards.map(card => (
                                <div key={card.id} className="opacity-60 hover:opacity-100 transition-opacity duration-300">
                                    <CardItem 
                                        card={card} 
                                        onDelete={handleDeleteCard} 
                                        onEdit={handleEditCard} 
                                        onUpdateSpend={handleUpdateSpend}
                                        notificationPeriod={0} 
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
          </div>
        ) : viewMode === 'Advisor' ? (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            {masterKey && <CardAdvisor cards={cards} masterKey={masterKey} onOpenSettings={() => setIsSettingsOpen(true)} />}
          </div>
        ) : (
          <BenefitSearch cards={cards} />
        )}
      </main>

      {/* Floating Encryption Badge */}
      {cards.length > 0 && viewMode === 'Dashboard' && !isAppLocked && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
           <div className="bg-slate-900/80 dark:bg-white/10 text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl backdrop-blur-xl border border-white/10 animate-in slide-in-from-bottom-10 duration-1000">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">AES-256 Vault Secured</span>
           </div>
        </div>
      )}

      {showUpdateToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-in slide-in-from-bottom-5 fade-in duration-500">
          <div className="bg-slate-900/90 dark:bg-blue-600/90 text-white p-4 rounded-2xl shadow-2xl backdrop-blur-md border border-white/10 flex items-start gap-4">
            <div className="p-2 bg-white/10 rounded-xl shrink-0">
              <Sparkles size={20} className="text-yellow-300" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-black">New Update Available 🎉</h4>
              <p className="text-xs font-medium text-white/80 mt-1">App has been refreshed with improvements.</p>
            </div>
            <button onClick={() => setShowUpdateToast(false)} className="p-1 hover:bg-white/10 rounded-lg">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {isFormOpen && masterKey && <CardForm onSave={handleSaveCard} onCancel={closeForm} initialData={editingCard} cards={cards} masterKey={masterKey} onOpenSettings={() => setIsSettingsOpen(true)} />}
      {isSettingsOpen && masterKey && <SettingsModal cards={cards} onCardsSynced={(c) => setCards(c)} onClose={() => setIsSettingsOpen(false)} masterKey={masterKey} onNotifPeriodChange={setNotificationPeriodState} />}
    </div>
  );
};

export default App;
