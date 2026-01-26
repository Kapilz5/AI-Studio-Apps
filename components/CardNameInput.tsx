import React, { useState, useEffect } from 'react';
import { Search, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { getCardSuggestions } from '../services/geminiService';
import { getDecryptedApiKey } from '../utils/storage';

interface CardNameInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (val: string) => void;
  masterKey: Uint8Array;
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
  masterKey,
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
  const [isTyping, setIsTyping] = useState(false);
  const [validationMsg, setValidationMsg] = useState('');
  const [hasBeenSelected, setHasBeenSelected] = useState(false);

  // Sync internal validation state with parent
  useEffect(() => {
    onValidationChange?.(validationMsg);
  }, [validationMsg, onValidationChange]);

  useEffect(() => {
    if (hasBeenSelected) {
      setSuggestions([]);
      setValidationMsg('');
      return;
    }

    // Clear messages if input is empty
    if (!value.trim()) {
        setSuggestions([]);
        setValidationMsg('');
        return;
    }

    const timer = setTimeout(async () => {
      const trimmedName = value.trim();
      if (trimmedName.length >= 2) {
        setIsTyping(true);
        try {
          const apiKey = await getDecryptedApiKey(masterKey);
          if (!apiKey) {
            if (showValidationMessage) setValidationMsg("AI Key missing. Check Settings.");
            setIsTyping(false);
            return;
          }

          const result = await getCardSuggestions(trimmedName, category, apiKey);
          setSuggestions(result.suggestions);
          
          if (showValidationMessage) {
            if (result.suggestions.length === 0) {
              setValidationMsg("AI could not verify this product. Enter benefits manually.");
            } else {
              setValidationMsg("Identify your specific card for accurate AI benefits:");
            }
          }
        } catch (err) {
          if (showValidationMessage) setValidationMsg("Search delayed. Proceeding with manual input.");
        }
        setIsTyping(false);
      } else {
        setSuggestions([]);
        setValidationMsg('');
      }
    }, 800); 
    
    return () => clearTimeout(timer);
  }, [value, category, hasBeenSelected, masterKey, showValidationMessage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setHasBeenSelected(false);
  };

  const handleSelectSuggestion = (name: string) => {
    onSelect(name);
    setHasBeenSelected(true);
    setSuggestions([]);
    setValidationMsg('');
  };

  // Determine if dropdown should show
  const shouldShowDropdown = !isTyping && (
    (suggestions.length > 0 && !hasBeenSelected) || 
    (showValidationMessage && validationMsg !== '')
  );

  return (
    <div className={`relative ${className}`}>
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`w-full px-5 py-4 rounded-2xl border-2 dark:bg-slate-800 dark:text-white ${validationMsg.includes('correct') ? 'border-rose-400' : 'border-slate-100 dark:border-slate-700'} focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold truncate pr-10`}
        />
        {isTyping && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 size={18} className="animate-spin text-blue-500" /></div>}
        {rightElement}

        {shouldShowDropdown && (
            <div className={`absolute top-full left-0 right-0 mt-3 z-[60] rounded-2xl p-5 border-2 animate-in slide-in-from-top-2 shadow-xl ${validationMsg.includes('correct') ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                {showValidationMessage && validationMsg && (
                    <div className={`flex items-start gap-3 text-[10px] font-black uppercase tracking-widest mb-3 ${validationMsg.includes('correct') ? 'text-rose-600' : 'text-slate-400'}`}>
                        {validationMsg.includes('correct') ? <AlertCircle size={14} /> : <Search size={14} />}
                        <span>{validationMsg}</span>
                    </div>
                )}
                
                {suggestions.length > 0 && (
                    <>
                        {!showValidationMessage && (
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <Sparkles size={12} className="text-blue-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI Suggestions</span>
                            </div>
                        )}
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
                    </>
                )}
            </div>
        )}
    </div>
  );
};

export default CardNameInput;