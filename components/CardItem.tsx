
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard as CardType } from '../types';
import { Trash2, TrendingUp, Edit3, Tag, CreditCard as LucideCreditCard, AlertCircle, Eye, EyeOff, Lock, Clock, Plus, X, Check, PartyPopper, Copy, ClipboardCheck, CalendarOff } from 'lucide-react';
import SecurityAuth from './SecurityAuth';
import { UI_STRINGS } from '../locales/en';

interface CardItemProps {
  card: CardType;
  onDelete: (id: string) => void;
  onEdit: (card: CardType) => void;
  onUpdateSpend?: (id: string, amount: number) => void;
  notificationPeriod?: number;
}

const CardItem: React.FC<CardItemProps> = ({ card, onDelete, onEdit, onUpdateSpend, notificationPeriod = 2 }) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSensitiveVisible, setIsSensitiveVisible] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAuthAction, setPendingAuthAction] = useState<'view' | 'copy' | null>(null);
  const [revealTimeLeft, setRevealTimeLeft] = useState(0);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  
  // 3D Tilt State
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  
  const startX = useRef(0);
  const currentX = useRef(0);
  const swipeThreshold = -60;
  const maxSwipe = -120;

  const isExpired = card.status === 'expired';
  // Logic: If card is expired, it is treated as "locked" (blurred) until user authenticates via View.
  const isLockedExpired = isExpired && !isSensitiveVisible;

  // 1. Anti-Screenshot / Privacy Blur
  // Immediately hide sensitive data if the app goes to background (user switches apps, opens task switcher)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsSensitiveVisible(false);
        setRevealTimeLeft(0);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 2. Reveal Timeout: 60 Seconds
  useEffect(() => {
    let timer: any;
    if (isSensitiveVisible && revealTimeLeft > 0) {
      timer = setInterval(() => {
        setRevealTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (revealTimeLeft === 0) {
      setIsSensitiveVisible(false);
    }
    return () => clearInterval(timer);
  }, [isSensitiveVisible, revealTimeLeft]);

  // FIX: Match month-based difference logic with App.tsx
  const expiring = useMemo(() => {
    if (isExpired) return false; // Don't show "Expiring Soon" if already expired
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const period = notificationPeriod;
    
    const monthDiff = (card.expiryYear - currentYear) * 12 + (card.expiryMonth - currentMonth);
    return monthDiff >= 0 && monthDiff <= period;
  }, [card.expiryMonth, card.expiryYear, notificationPeriod, isExpired]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const isWaived = card.waiverTarget > 0 && card.currentSpend >= card.waiverTarget;
  const waiverProgress = card.waiverTarget > 0 ? Math.min(100, (card.currentSpend / card.waiverTarget) * 100) : 0;

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (showConfirm) return;
    setIsDragging(true);
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    startX.current = clientX - swipeOffset;
    currentX.current = clientX;
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || showConfirm) return;
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const deltaX = clientX - startX.current;
    
    if (deltaX <= 0) setSwipeOffset(Math.max(deltaX, maxSwipe));
    else setSwipeOffset(0);
    currentX.current = clientX;
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (swipeOffset < swipeThreshold) setSwipeOffset(maxSwipe);
    else setSwipeOffset(0);
  };

  // 3D Tilt Logic
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isExpired || isDragging) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const maxRotate = 8;
    
    const rotateX = ((y - centerY) / centerY) * -maxRotate;
    const rotateY = ((x - centerX) / centerX) * maxRotate;
    
    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  const handleToggleSensitive = () => {
    if (isSensitiveVisible) {
      // Manual Hide
      setIsSensitiveVisible(false);
      setRevealTimeLeft(0);
    } else {
      // Authenticate to Show
      setPendingAuthAction('view');
      setShowAuthModal(true);
    }
  };

  const onAuthSuccess = () => {
    setShowAuthModal(false);
    
    if (pendingAuthAction === 'view') {
        setIsSensitiveVisible(true);
        setRevealTimeLeft(60); // 60s limit as per session requirement
    } else if (pendingAuthAction === 'copy') {
        performCopy();
    }
    setPendingAuthAction(null);
  };

  const performCopy = async () => {
    if (!card.fullNumber) return;
    try {
      await navigator.clipboard.writeText(card.fullNumber);
      setCopyStatus('copied');
      
      // Reset icon after 2s
      setTimeout(() => setCopyStatus('idle'), 2000);

      // Auto-clear clipboard after 30s
      setTimeout(() => {
        navigator.clipboard.writeText(' ').catch(() => {});
      }, 30000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // 3. Secure Copy with Auth Check
  const handleSecureCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Strict security: Always authenticate before copying to clipboard, even if currently visible
    setPendingAuthAction('copy');
    setShowAuthModal(true);
  };

  const formatFullNumber = (num: string) => {
    if (!num) return '•••• •••• •••• ' + card.last4;
    if (!isSensitiveVisible) {
        return num.replace(/\d/g, (match, offset) => {
            return offset < (num.length - 4) && match !== ' ' ? '•' : match;
        });
    }
    return num;
  };

  const renderNetworkLogo = (type?: string) => {
    const t = (type || '').toLowerCase();
    const containerClass = "flex items-center justify-center h-7 px-2.5 bg-white rounded-lg shadow-sm border border-white/20 shrink-0";
    if (t.includes('visa')) return <div className={containerClass}><span className="text-[#1a1f71] font-black italic text-[11px] tracking-tighter leading-none">VISA</span></div>;
    if (t.includes('mastercard')) return <div className="flex items-center -space-x-2 h-7 shrink-0"><div className="w-5 h-5 rounded-full bg-[#eb001b]" /><div className="w-5 h-5 rounded-full bg-[#f79e1b] opacity-90" /></div>;
    if (t.includes('amex') || t.includes('american')) return <div className="h-7 w-9 bg-[#016fd0] rounded-lg flex items-center justify-center border border-white/20 shadow-sm overflow-hidden shrink-0"><span className="text-[9px] font-black text-white italic tracking-tighter">AMEX</span></div>;
    if (t.includes('rupay')) return <div className={containerClass}><div className="text-[10px] font-black italic tracking-tighter leading-none"><span className="text-[#f37021]">Ru</span><span className="text-[#253b80]">Pay</span></div></div>;
    return <LucideCreditCard size={22} className="text-white/60 drop-shadow-md shrink-0" />;
  };

  return (
    <div 
        className={`relative overflow-visible animate-in fade-in slide-in-from-bottom-2 duration-300 group text-left ${isExpired ? 'opacity-80 grayscale-[0.6]' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
    >
      {showAuthModal && createPortal(
        <SecurityAuth 
            mode="verify" 
            onSuccess={onAuthSuccess} 
            onCancel={() => { setShowAuthModal(false); setPendingAuthAction(null); }} 
        />,
        document.body
      )}
      <div className="absolute inset-0 flex justify-end items-stretch p-2">
        <button onClick={() => { setShowConfirm(true); setSwipeOffset(0); }} className="w-[110px] h-full bg-rose-600 text-white rounded-[2.5rem] flex flex-col items-center justify-center shadow-lg transition-transform active:scale-95">
          <Trash2 size={24} className="mb-1" />
          <span className="text-[10px] font-black uppercase tracking-widest">{UI_STRINGS.common.delete}</span>
        </button>
      </div>

      {showConfirm && (
        <div className="absolute inset-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-[2.5rem] border-2 border-rose-100 dark:border-rose-900/50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-200 shadow-2xl">
            <h4 className="text-slate-900 dark:text-white font-black text-xl mb-1">Remove Card?</h4>
            <div className="flex gap-3 w-full max-w-[240px]">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-sm"><X size={18} className="mx-auto" /></button>
                <button onClick={() => onDelete(card.id)} className="flex-1 py-3.5 bg-rose-600 text-white rounded-2xl font-black text-sm"><Check size={18} className="mx-auto" /></button>
            </div>
        </div>
      )}

      <div 
        className={`relative z-10 select-none cursor-grab active:cursor-grabbing ${isDragging ? 'transition-none' : 'transition-transform duration-300 ease-out'}`}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
        onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd}
      >
        <div className="relative transition-all duration-500 flex flex-col perspective-1000">
          <div 
            ref={cardRef}
            className={`relative p-8 rounded-[2.5rem] shadow-2xl text-white aspect-[1.58/1] flex flex-col justify-between overflow-hidden ${isExpired ? 'bg-slate-500 border border-slate-400' : 'card-gradient'} ${expiring ? 'ring-4 ring-rose-400/80 shadow-rose-500/40 scale-[1.02]' : ''}`}
            style={{
                transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
                transition: 'transform 0.1s ease-out',
                transformStyle: 'preserve-3d'
            }}
          >
            
            {/* Glare Effect */}
            {!isExpired && (
                <div 
                    className="absolute inset-0 pointer-events-none z-0"
                    style={{
                        background: `radial-gradient(circle at ${50 - rotate.y * 3}% ${50 - rotate.x * 3}%, rgba(255,255,255,0.2) 0%, transparent 60%)`,
                        opacity: Math.abs(rotate.x) + Math.abs(rotate.y) > 0 ? 1 : 0,
                        transition: 'opacity 0.2s ease'
                    }}
                />
            )}

            {/* Visual Blurred Overlay for Expired Locked State */}
            {isLockedExpired && (
                <div className="absolute inset-0 z-20 backdrop-blur-[4px] bg-slate-900/10 flex items-end justify-end p-6 rounded-[2.5rem] transition-all duration-500">
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleToggleSensitive(); }}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-full shadow-lg shadow-amber-500/30 border border-amber-400 hover:bg-amber-400 transition-all active:scale-95 group/badge"
                        title="This card is expired. Unlock vault to view details."
                    >
                        <Lock size={12} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Expired – Unlock to View</span>
                    </button>
                </div>
            )}

            {!isExpired && expiring && (
              <div className="absolute top-4 left-4 bg-rose-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest z-20 flex items-center gap-1 shadow-lg animate-pulse" style={{ transform: 'translateZ(20px)' }}>
                <AlertCircle size={10} />
                <span>Expiring Soon</span>
              </div>
            )}

            <div className="flex justify-between items-start z-10" style={{ transform: 'translateZ(20px)' }}>
              <div className={`w-14 h-10 rounded-lg shadow-inner opacity-90 ${isExpired ? 'bg-slate-600' : 'bg-gradient-to-br from-yellow-300 to-yellow-600'}`} />
              <div className="flex flex-col items-end gap-3">
                <span className="text-[10px] font-black bg-white/10 px-2 py-1 rounded-lg uppercase tracking-widest backdrop-blur-md border border-white/10">{card.cardCategory || 'CARD'}</span>
                <button 
                    onClick={(e) => { e.stopPropagation(); handleToggleSensitive(); }} 
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all border ${isSensitiveVisible ? 'bg-white text-slate-900 border-white' : 'bg-white/10 hover:bg-white/20 text-white border-white/20'}`}
                >
                  {isSensitiveVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  <span className="text-[10px] font-black uppercase tracking-widest">{isSensitiveVisible ? 'Hide' : 'View'}</span>
                </button>
              </div>
            </div>
            
            <div className={`z-10 min-w-0 transition-all duration-500 ${isLockedExpired ? 'blur-[3px] opacity-60' : ''}`} style={{ transform: 'translateZ(30px)' }}>
              <div className="flex items-center gap-4 mb-3">
                {renderNetworkLogo(card.cardType)}
                <h3 className="text-2xl font-black truncate tracking-tight min-w-0 select-none" title={card.name}>{card.name}</h3>
              </div>
              <div className="flex items-center gap-4">
                  {/* Prevent selection of card number to avoid clipboard leaks, force use of button */}
                  <div className="text-white/70 font-mono text-xl tracking-[0.2em] select-none pointer-events-none">
                    {formatFullNumber(card.fullNumber)}
                  </div>
                  <button 
                      onClick={handleSecureCopy}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                      title="Secure Copy (Requires Auth)"
                  >
                      {copyStatus === 'copied' ? <ClipboardCheck size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
              </div>
            </div>

            <div className={`flex justify-between items-end z-10 border-t border-white/10 pt-4 transition-all duration-500 ${isLockedExpired ? 'blur-[3px] opacity-60' : ''}`} style={{ transform: 'translateZ(20px)' }}>
              <div className="flex gap-8 text-left">
                <div>
                  <p className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1">Expires</p>
                  <span className={`font-mono text-lg font-black select-none ${expiring ? 'text-rose-300 underline' : ''}`}>{String(card.expiryMonth).padStart(2, '0')}/{String(card.expiryYear).slice(-2)}</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1">CVV</p>
                  <span className="font-mono text-lg font-black tracking-widest select-none">{isSensitiveVisible ? card.cvv : '•••'}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1">Fee</p>
                <p className="font-black text-xl select-none">{formatCurrency(card.annualFee)}</p>
              </div>
            </div>
          </div>
          {card.bestOffer && !isExpired && (
            <div className="bg-amber-50 dark:bg-amber-900/30 mx-8 -mt-4 p-4 rounded-b-[1.5rem] border-x border-b border-amber-100 dark:border-amber-900/50 shadow-sm z-0 flex items-center gap-3 transition-transform duration-300 hover:translate-y-1">
              <Tag size={14} className="text-amber-600 shrink-0" />
              <p className="text-[11px] font-black text-amber-900 dark:text-amber-100 leading-tight line-clamp-1">{card.bestOffer}</p>
            </div>
          )}
          {card.waiverTarget > 0 && !isExpired && (
            <div className={`mx-6 mt-3 p-6 rounded-[2rem] shadow-lg border z-0 transition-all duration-300 hover:shadow-xl ${isWaived ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-100' : 'bg-white dark:bg-slate-900 border-slate-100'}`}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{isWaived ? 'Fee Waived!' : 'Waiver Target'}</span>
                <span className="text-xs font-black px-3 py-1 rounded-full bg-blue-50 text-blue-600">{Math.round(waiverProgress)}%</span>
              </div>
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4 p-0.5">
                <div className={`h-full rounded-full ${isWaived ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${waiverProgress}%` }} />
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm font-black">{formatCurrency(card.currentSpend)} / {formatCurrency(card.waiverTarget)}</p>
                <button onClick={() => { const val = prompt("Enter spend amount to add:"); if (val && !isNaN(Number(val))) onUpdateSpend?.(card.id, Number(val)); }} className="text-xs font-black text-white bg-slate-900 px-5 py-2.5 rounded-xl active:scale-95 transition-all">Add</button>
              </div>
            </div>
          )}
          <div className="absolute -top-3 -right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
            <button onClick={(e) => { e.stopPropagation(); onEdit(card); }} className="p-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl shadow-xl hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110"><Edit3 size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardItem;
