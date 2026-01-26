import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { getCardSuggestions } from '../services/geminiService';

interface CardNameInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (val: string) => void;
  masterKey?: Uint8Array; // Optional now as not needed for suggestions
  category?: string;
  placeholder?: string;
  className?: string;
  onValidationChange?: (msg: string) => void;
  showValidationMessage?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  rightElement?: React.ReactNode;
}

const CardNameInput: React.FC<CardNameInputProps> = ({
  value,
  onChange,
  onSelect,
  category,
  placeholder,
  className = '',
  onValidationChange,
  showValidationMessage = true,
  autoFocus,
  onKeyDown,
  rightElement
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [hasBeenSelected, setHasBeenSelected] = useState(false);

  useEffect(() => {
    // If user just selected a card, don't show suggestions again immediately
    if (hasBeenSelected) {
      setSuggestions([]);
      return;
    }

    if (!value.trim() || value.length < 2) {
      setSuggestions([]);
      return;
    }

    // Call local suggestion service (Synchronous now)
    getCardSuggestions(value, category).then(result => {
       setSuggestions(result.suggestions);
    });

  }, [value, category, hasBeenSelected]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setHasBeenSelected(false);
  };

  const handleSelectSuggestion = (name: string) => {
    onSelect(name);
    setHasBeenSelected(true);
    setSuggestions([]);
  };

  const shouldShowDropdown = suggestions.length > 0 && !hasBeenSelected;

  return (
    <div className={`relative ${className}`}>
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`w-full px-5 py-4 rounded-2xl border-2 dark:bg-slate-800 dark:text-white border-slate-100 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold truncate pr-10`}
        />
        {rightElement}

        {shouldShowDropdown && (
            <div className={`absolute top-full left-0 right-0 mt-3 z-[60] rounded-2xl p-5 border-2 animate-in slide-in-from-top-2 shadow-xl bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700`}>
                <div className="flex items-center gap-2 mb-3 px-1">
                    <Search size={12} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Suggestions</span>
                </div>
                <div className="flex flex-wrap gap-2">
                {suggestions.map((s, idx) => (
                    <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="text-[10px] font-black px-4 py-2 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-2 border-slate-200 dark:border-slate-600 rounded-xl hover:border-blue-500 transition-all active:scale-95 text-left"
                    >
                    {s}
                    </button>
                ))}
                </div>
            </div>
        )}
    </div>
  );
};

export default CardNameInput;