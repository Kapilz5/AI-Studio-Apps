
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CreditCard as CardType } from '../types';
import { Trash2, TrendingUp, Edit3, Tag, CreditCard as LucideCreditCard, AlertCircle, Eye, EyeOff, Lock, Clock, Plus, X, Check } from 'lucide-react';
import SecurityAuth from './SecurityAuth';

interface CardItemProps {
  card: CardType;
  onDelete: (id: string) => void;
  onEdit: (card: CardType) => void;
  onUpdateSpend?: (id: string, amount: number) => void;
}

const CardItem: React.FC<CardItemProps> = ({ card, onDelete, onEdit, onUpdateSpend }) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSensitiveVisible, setIsSensitiveVisible] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [revealTimeLeft, setRevealTimeLeft] = useState(0);
  
  const startX = useRef(0);
  const currentX = useRef(0);
  const swipeThreshold = -60;
  const maxSwipe = -120;

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

  const expiring = useMemo(() => {
    const expiryDate = new Date(card.expiryYear, card.expiryMonth - 1);
    const now = new Date();
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(now.getMonth() + 3);
    return expiryDate <= threeMonthsFromNow;
  }, [card.expiryMonth, card.expiryYear]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const waiverProgress = card.waiverTarget > 0 ? Math.min(100, (card.currentSpend / card.waiverTarget) * 100) : 0;

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (showConfirm) return;
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startX.current = clientX - swipeOffset;
    currentX.current = clientX;
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || showConfirm) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - startX.current;
    
    // Only allow left swipe
    if (deltaX <= 0) {
      setSwipeOffset(Math.max(deltaX, maxSwipe));
    } else {
      setSwipeOffset(0);
    }
    currentX.current = clientX;
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (swipeOffset < swipeThreshold) {
      setSwipeOffset(maxSwipe);
    } else {
      setSwipeOffset(0);
    }
  };

  const handleToggleSensitive = () => {
    if (isSensitiveVisible) {
      setIsSensitiveVisible(false);
      setRevealTimeLeft(0);
    } else {
      setShowAuthModal(true);
    }
  };

  const onAuthSuccess = () => {
    setIsSensitiveVisible(true);
    setRevealTimeLeft(30);
    setShowAuthModal(false);
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
    const containerClass = "flex items-center justify-center h-7 px-2.5 bg-white rounded-lg shadow-sm border border-white/20";
    
    if (t.includes('visa')) {
      return (
        <div className={containerClass}>
          <span className="text-[#1a1f71] font-black italic text-[11px] tracking-tighter leading-none">VISA</span>
        </div>
      );
    }
    if (t.includes('mastercard')) {
      return (
        <div className="flex items-center -space-x-2 h-7">
          <div className="w-5 h-5 rounded-full bg-[#eb001b]" />
          <div className="w-5 h-5 rounded-full bg-[#f79e1b] opacity-90" />
        </div>
      );
    }
    if (t.includes('amex') || t.includes('american')) {
      return (
        <div className="h-7 w-9 bg-[#016fd0] rounded-lg flex items-center justify-center border border-white/20 shadow-sm overflow-hidden">
          <span className="text-[9px] font-black text-white italic tracking-tighter">AMEX</span>
        </div>
      );
    }
    if (t.includes('rupay')) {
      return (
        <div className={containerClass}>
          <div className="text-[10px] font-black italic tracking-tighter leading-none">
            <span className="text-[#f37021]">Ru</span><span className="text-[#253b80]">Pay</span>
          </div>
        </div>
      );
    }
    if (t.includes('discover')) {
      return (
        <div className={containerClass}>
          <span className="text-[#ff6000] font-black italic text-[9px] tracking-tighter leading-none uppercase">Discover</span>
        </div>
      );
    }
    
    return <LucideCreditCard size={22} className="text-white/60 drop-shadow-md" />;
  };

  return (
    <div className="relative overflow-visible animate-in fade-in slide-in-from-bottom-2 duration-300 group">
      {showAuthModal && (
        <SecurityAuth mode="verify" onSuccess={onAuthSuccess} onCancel={() => setShowAuthModal(false)} />
      )}

      {/* Swipe Delete Action (Behind Card) */}
      <div className="absolute inset-0 flex justify-end items-stretch p-2">
        <button
          onClick={() => { setShowConfirm(true); setSwipeOffset(0); }}
          className="w-[110px] h-full bg-rose-600 text-white rounded-[2.5rem] flex flex-col items-center justify-center shadow-lg transition-transform active:scale-95"
        >
          <Trash2 size={24} className="mb-1" />
          <span className="text-[10px] font-black uppercase tracking-widest">Delete</span>
        </button>
      </div>

      {/* Confirmation Overlay */}
      {showConfirm && (
        <div className="absolute inset-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-[2.5rem] border-2 border-rose-100 dark:border-rose-900/50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-200 shadow-2xl">
            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mb-4">
                <AlertCircle size={32} />
            </div>
            <h4 className="text-slate-900 dark:text-white font-black text-xl mb-1">Remove Card?</h4>
            <p className="text-xs text-slate-500 mb-6 font-medium">This will permanently delete this card from your secure vault.</p>
            <div className="flex gap-3 w-full max-w-[240px]">
                <button 
                  onClick={() => setShowConfirm(false)} 
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  <X size={18} className="mx-auto" />
                </button>
                <button 
                  onClick={() => onDelete(card.id)} 
                  className="flex-1 py-3.5 bg-rose-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-200 dark:shadow-rose-900/20 hover:bg-rose-700 transition-all"
                >
                  <Check size={18} className="mx-auto" />
                </button>
            </div>
        </div>
      )}

      {/* Interactive Card Surface */}
      <div 
        className={`relative z-10 transition-transform duration-300 ease-out select-none cursor-grab active:cursor-grabbing ${isDragging ? 'transition-none' : ''}`}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
        onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd}
      >
        <div className="relative transition-all duration-500 flex flex-col">
          <div className={`card-gradient relative p-8 rounded-[2.5rem] shadow-2xl text-white aspect-[1.58/1] flex flex-col justify-between overflow-hidden transition-all duration-300 ${expiring ? 'ring-4 ring-rose-400/40 shadow-rose-200/20' : ''}`}>
            <div className="flex justify-between items-start z-10">
              <div className="w-14 h-10 bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 rounded-lg shadow-inner opacity-90 relative overflow-hidden">
                 <div className="absolute inset-0 flex items-center justify-around opacity-30">
                    <div className="w-0.5 h-full bg-black/40" /><div className="w-0.5 h-full bg-black/40" /><div className="w-0.5 h-full bg-black/40" />
                 </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-black bg-white/10 px-2 py-1 rounded-lg uppercase tracking-widest backdrop-blur-md border border-white/10">
                    {card.cardCategory || 'CARD'}
                  </span>
                  {isSensitiveVisible && (
                    <div className="flex items-center gap-1.5 bg-emerald-500 text-white px-2 py-1 rounded-lg font-black text-[10px] animate-pulse">
                      <Clock size={10} />
                      {revealTimeLeft}s
                    </div>
                  )}
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleToggleSensitive(); }}
                  className={`p-2.5 rounded-2xl transition-all active:scale-90 ${isSensitiveVisible ? 'bg-white text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  {isSensitiveVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="z-10">
              <div className="flex items-center gap-4 mb-3">
                {renderNetworkLogo(card.cardType)}
                <h3 className="text-2xl font-black truncate tracking-tight">{card.name}</h3>
              </div>
              <div className="flex items-center space-x-2 text-white/70 font-mono text-xl tracking-[0.2em] drop-shadow-sm">
                <span>{formatFullNumber(card.fullNumber)}</span>
              </div>
            </div>

            <div className="flex justify-between items-end z-10 border-t border-white/10 pt-4">
              <div className="flex gap-8">
                <div>
                  <p className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1">Expires</p>
                  <span className={`font-mono text-lg font-black ${expiring ? 'text-rose-300 underline underline-offset-4' : ''}`}>
                    {String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1">CVV</p>
                  <div className="flex items-center gap-1.5">
                    <Lock size={12} className="text-white/40" />
                    <span className="font-mono text-lg font-black tracking-widest">
                      {isSensitiveVisible ? card.cvv : '•••'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1">Fee</p>
                <p className="font-black text-xl">{formatCurrency(card.annualFee)}</p>
              </div>
            </div>

            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
          </div>

          {card.bestOffer && (
            <div className="bg-amber-50 dark:bg-amber-900/30 mx-8 -mt-4 p-4 rounded-b-[1.5rem] border-x border-b border-amber-100 dark:border-amber-900/50 shadow-sm z-0 flex items-center gap-3 transition-all">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-800 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Tag size={14} />
              </div>
              <p className="text-[11px] font-black text-amber-900 dark:text-amber-100 leading-tight line-clamp-1">{card.bestOffer}</p>
            </div>
          )}

          {card.waiverTarget > 0 && (
            <div className="bg-white dark:bg-slate-900 mx-6 mt-3 p-6 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-800 z-0 transition-all hover:border-blue-200">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-lg ${waiverProgress >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                    <TrendingUp size={16} />
                  </div>
                  <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Waiver Target</span>
                </div>
                <span className={`text-xs font-black px-3 py-1 rounded-full ${waiverProgress >= 100 ? 'bg-emerald-500 text-white' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                  {Math.round(waiverProgress)}%
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4 p-0.5">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${waiverProgress >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} 
                  style={{ width: `${waiverProgress}%` }} 
                />
              </div>
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Progress</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{formatCurrency(card.currentSpend)} / {formatCurrency(card.waiverTarget)}</p>
                </div>
                {onUpdateSpend && (
                  <button onClick={() => { const val = prompt("Enter spend amount to add:"); if (val && !isNaN(Number(val))) onUpdateSpend(card.id, Number(val)); }} className="flex items-center space-x-2 text-xs font-black text-white bg-slate-900 dark:bg-slate-700 px-5 py-2.5 rounded-xl hover:bg-blue-600 transition-all shadow-lg active:scale-95">
                    <Plus size={14} /><span>Add</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="absolute -top-3 -right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-20">
            <button onClick={(e) => { e.stopPropagation(); onEdit(card); }} className="p-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl shadow-xl hover:bg-blue-600 hover:text-white transition-all"><Edit3 size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardItem;
