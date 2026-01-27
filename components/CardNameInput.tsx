
import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { getCardSuggestions } from '../services/geminiService';
import { CardCategory } from '../types';

interface CardNameInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (val: string) => void;
  apiKey: string | undefined;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  category?: CardCategory;
}

const CardNameInput: React.FC<CardNameInputProps> = ({
  value,
  onChange,
  onSelect,
  apiKey,
  placeholder,
  className = '',
  autoFocus,
  onKeyDown,
  disabled,
  category = 'Credit'
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Force strict reset on mount to prevent state persistence across form instances
  useEffect(() => {
    setSuggestions([]);
    setError('');
    setIsTyping(false);
    setShowDropdown(false);
  }, []);

  useEffect(() => {
    // Hide dropdown if clicked outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Debounced suggestion fetch
    if (!value || value.length < 2) {
      setSuggestions([]);
      setError('');
      setIsTyping(false);
      return;
    }

    // Don't fetch if dropdown is hidden (user selected or clicked away)
    if (!showDropdown) return;

    const timer = setTimeout(async () => {
      if (!apiKey) {
        // Only show error if we really intended to fetch
        if (value.length >= 2) {
             setError("AI suggestions unavailable (No API Key)");
        }
        return;
      }

      setIsTyping(true);
      setError(''); // Clear any previous error before new attempt
      
      try {
        const result = await getCardSuggestions(value, apiKey, category as CardCategory);
        if (result.suggestions && result.suggestions.length > 0) {
          setSuggestions(result.suggestions);
          setError('');
        } else {
          setSuggestions([]);
          if (result.error) {
              // Ensure we don't persist error if user kept typing
              setError("AI unavailable – type manually"); 
          }
        }
      } catch (err) {
        console.error(err);
        setSuggestions([]);
        setError("AI unavailable – type manually");
      } finally {
        setIsTyping(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [value, apiKey, showDropdown, category]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowDropdown(true);
    // IMMEDIATE RESET: Clear error as soon as user types to allow fresh calls
    if (error) setError('');
    if (suggestions.length > 0) setSuggestions([]);
  };

  const handleSuggestionClick = (name: string) => {
    onChange(name);
    if (onSelect) onSelect(name);
    setShowDropdown(false);
    setSuggestions([]);
    setError('');
  };

  const handleFocus = () => {
      if (value.length >= 2) {
          setShowDropdown(true);
          // Allow fresh call attempt on focus if previously failed
          if (error) setError('');
      }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="off"
          className="w-full pl-5 pr-12 py-4 rounded-2xl border-2 dark:bg-slate-800 dark:text-white border-slate-100 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold truncate"
        />
        {isTyping && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 size={18} className="animate-spin text-blue-500" />
          </div>
        )}
      </div>

      {showDropdown && (suggestions.length > 0 || error) && (
        <div className="absolute top-full left-0 right-0 mt-2 z-[999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-top-2 max-h-64 flex flex-col">
          {suggestions.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <Sparkles size={12} className="text-blue-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI Suggestions ({category})</span>
              </div>
              <div className="overflow-y-auto custom-scrollbar">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSuggestionClick(s)}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-none"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
          {error && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 flex items-center gap-2 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertCircle size={14} />
              <span className="text-[10px] font-bold">{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CardNameInput;
