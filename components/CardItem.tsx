
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CreditCard as CardType } from '../types';
import { Trash2, TrendingUp, Edit3, Tag, CreditCard as LucideCreditCard, AlertCircle, Eye, EyeOff, Lock, Clock, Plus, X, Check, PartyPopper } from 'lucide-react';
import SecurityAuth from './SecurityAuth';
import { UI_STRINGS } from '../locales/en';
import { getNotificationPeriod } from '../utils/storage';

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
    // Card expiry is effectively valid until the last day of the month
    const expiryDate = new Date(card.expiryYear, card.expiryMonth, 0, 23, 59, 59);
    const now = new Date();
    const period = getNotificationPeriod();
    const thresholdDate = new Date();
    thresholdDate.setMonth(now.getMonth() + period);
    
    // It's expiring if the end of month is within the warning period
    return expiryDate <= thresholdDate && expiryDate >= now;
  }, [card.expiryMonth, card.expiryYear]);

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

  const handleToggleSensitive = () => {
    if (isSensitiveVisible) {
      setIsSensitiveVisible(false);
      setRevealTimeLeft(0);
    } else setShowAuthModal(true);
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
    if (t.includes('visa')) return <div className={containerClass}><span className="text-[#1a1f71] font-black italic text-[11px] tracking-tighter leading-none">VISA</span></div>;
    if (t.includes('mastercard')) return <div className="flex items-center -space-x-2 h-7"><div className="w-5 h-5 rounded-full bg-[#eb001b]" /><div className="w-5 h-5 rounded-full bg-[#f79e1b] opacity-90" /></div>;
    if (t.includes('amex') || t.includes('american')) return <div className="h-7 w-9 bg-[#016fd0] rounded-lg flex items-center justify-center border border-white/20 shadow-sm overflow-hidden"><span className="text-[9px] font-black text-white italic tracking-tighter">AMEX</span></div>;
    if (t.includes('rupay')) return <div className={containerClass}><div className="text-[10px] font-black italic tracking-tighter leading-none"><span className="text-[#f37021]">Ru</span><span className="text-[#253b80]">Pay</span></div></div>;
    return <LucideCreditCard size={22} className="text-white/60 drop-shadow-md" />;
  };

  return (
    <div className="relative overflow-visible animate-in fade-in slide-in-from-bottom-2 duration-300 group text-left">
      {showAuthModal && <SecurityAuth mode="verify" onSuccess={onAuthSuccess} onCancel={() => setShowAuthModal(false)} />}
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
        className={`relative z-10 transition-transform duration-300 ease-out select-none cursor-grab active:cursor-grabbing ${isDragging ? 'transition-none' : ''}`}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
        onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd}
      >
        <div className="relative transition-all duration-500 flex flex-col">
          <div className={`card-gradient relative p-8 rounded-[2.5rem] shadow-2xl text-white aspect-[1.58/1] flex flex-col justify-between overflow-hidden ${expiring ? 'ring-4 ring-rose-400/80 shadow-rose-500/40 scale-[1.02]' : ''}`}>
            {expiring && (
              <div className="absolute top-4 left-4 bg-rose-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest z-20 flex items-center gap-1 shadow-lg animate-pulse">
                <AlertCircle size={10} />
                <span>Expiring Soon</span>
              </div>
            )}
            <div className="flex justify-between items-start z-10">
              <div className="w-14 h-10 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-lg shadow-inner opacity-90" />
              <div className="flex flex-col items-end gap-3">
                <span className="text-[10px] font-black bg-white/10 px-2 py-1 rounded-lg uppercase tracking-widest backdrop-blur-md border border-white/10">{card.cardCategory || 'CARD'}</span>
                <button onClick={(e) => { e.stopPropagation(); handleToggleSensitive(); }} className={`p-2.5 rounded-2xl transition-all ${isSensitiveVisible ? 'bg-white text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}>
                  {isSensitiveVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="z-10">
              <div className="flex items-center gap-4 mb-3">
                {renderNetworkLogo(card.cardType)}
                <h3 className="text-2xl font-black truncate tracking-tight">{card.name}</h3>
              </div>
              <div className="flex items-center space-x-2 text-white/70 font-mono text-xl tracking-[0.2em]">{formatFullNumber(card.fullNumber)}</div>
            </div>
            <div className="flex justify-between items-end z-10 border-t border-white/10 pt-4">
              <div className="flex gap-8 text-left">
                <div>
                  <p className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1">Expires</p>
                  <span className={`font-mono text-lg font-black ${expiring ? 'text-rose-300 underline' : ''}`}>{String(card.expiryMonth).padStart(2, '0')}/{card.expiryYear}</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1">CVV</p>
                  <span className="font-mono text-lg font-black tracking-widest">{isSensitiveVisible ? card.cvv : '•••'}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-black text-white/40 tracking-widest mb-1">Fee</p>
                <p className="font-black text-xl">{formatCurrency(card.annualFee)}</p>
              </div>
            </div>
          </div>
          {card.bestOffer && (
            <div className="bg-amber-50 dark:bg-amber-900/30 mx-8 -mt-4 p-4 rounded-b-[1.5rem] border-x border-b border-amber-100 dark:border-amber-900/50 shadow-sm z-0 flex items-center gap-3">
              <Tag size={14} className="text-amber-600 shrink-0" />
              <p className="text-[11px] font-black text-amber-900 dark:text-amber-100 leading-tight line-clamp-1">{card.bestOffer}</p>
            </div>
          )}
          {card.waiverTarget > 0 && (
            <div className={`mx-6 mt-3 p-6 rounded-[2rem] shadow-lg border z-0 transition-all ${isWaived ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-100' : 'bg-white dark:bg-slate-900 border-slate-100'}`}>
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
            <button onClick={(e) => { e.stopPropagation(); onEdit(card); }} className="p-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl shadow-xl hover:bg-blue-600 hover:text-white transition-all"><Edit3 size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardItem;
