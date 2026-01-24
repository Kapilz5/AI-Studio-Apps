import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

interface SpendUpdateModalProps {
  cardName: string;
  onSave: (amount: number) => void;
  onCancel: () => void;
}

const SpendUpdateModal: React.FC<SpendUpdateModalProps> = ({ cardName, onSave, onCancel }) => {
  const [amount, setAmount] = useState('');

  const handleSave = () => {
    const numericAmount = parseFloat(amount);
    if (!isNaN(numericAmount) && numericAmount > 0) {
      onSave(numericAmount);
    }
    setAmount('');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in slide-in-from-bottom-4 duration-300 border border-white/10">
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">Update Spend</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-6">For: <span className="text-blue-600 dark:text-blue-400">{cardName}</span></p>
        
        <input
          type="number"
          inputMode="decimal"
          placeholder="Enter amount to add"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full py-4 px-6 bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
          autoFocus
        />

        <div className="flex gap-3 pt-6">
          <button 
            onClick={onCancel}
            className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
          >
            <X size={18} className="mx-auto" />
          </button>
          <button 
            onClick={handleSave}
            disabled={!amount || parseFloat(amount) <= 0}
            className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-blue-500/30 disabled:opacity-50"
          >
            <Check size={18} className="mx-auto" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpendUpdateModal;