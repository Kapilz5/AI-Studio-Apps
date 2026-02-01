
import React, { useState } from 'react';
import { Sparkles, X, Wand2, RefreshCw, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import { generateCardArt } from '../services/geminiService';
import { getDecryptedApiKey } from '../utils/storage';
import { UI_STRINGS } from '../locales/en';

interface CardArtStudioProps {
  onApply: (base64Image: string) => void;
  onCancel: () => void;
  masterKey: Uint8Array;
  onOpenSettings?: () => void;
}

const PRESET_PROMPTS = [
  "Cyberpunk neon city skyline, dark purple and blue, cinematic",
  "Matte black titanium texture with gold geometric lines",
  "Abstract liquid marble, teal and gold swirls, high detailed",
  "Minimalist japanese landscape, red sun, mountains, ink style",
  "Futuristic circuit board, glowing blue energy, dark background"
];

const CardArtStudio: React.FC<CardArtStudioProps> = ({ onApply, onCancel, masterKey, onOpenSettings }) => {
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError('');
    setGeneratedImage(null);

    try {
      const apiKey = await getDecryptedApiKey(masterKey);
      if (!apiKey) {
        if (onOpenSettings) {
             if (window.confirm("Gemini API Key is missing. Open Settings?")) {
                 onOpenSettings();
             }
        } else {
             setError("API Key required for generation.");
        }
        setIsGenerating(false);
        return;
      }

      const base64 = await generateCardArt(prompt, apiKey);
      if (base64) {
        setGeneratedImage(base64);
      } else {
        setError("Failed to generate image. Try a different prompt.");
      }
    } catch (err: any) {
      setError(err.message || "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                    <Wand2 size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{UI_STRINGS.studio.title}</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{UI_STRINGS.studio.subtitle}</p>
                </div>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X size={20} className="text-slate-500" />
            </button>
        </div>

        <div className="p-6 space-y-6">
            {/* Input Section */}
            <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{UI_STRINGS.studio.prompt_label}</label>
                <div className="relative">
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={UI_STRINGS.studio.prompt_placeholder}
                        className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 outline-none resize-none h-24 font-medium text-slate-700 dark:text-slate-200 text-sm"
                    />
                    <div className="absolute bottom-3 right-3">
                         <Sparkles size={16} className={`transition-colors ${prompt.length > 5 ? 'text-purple-500 animate-pulse' : 'text-slate-400'}`} />
                    </div>
                </div>
                
                {/* Presets */}
                <div className="flex flex-wrap gap-2">
                    {PRESET_PROMPTS.slice(0, 3).map((p, i) => (
                        <button 
                            key={i} 
                            onClick={() => setPrompt(p)} 
                            className="text-[9px] font-bold px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-slate-500 hover:text-purple-600 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors truncate max-w-[150px]"
                        >
                            {p.substring(0, 20)}...
                        </button>
                    ))}
                </div>
            </div>

            {/* Preview Section */}
            <div className="relative aspect-[1.58/1] rounded-[1.5rem] bg-slate-100 dark:bg-slate-950 border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden flex items-center justify-center group">
                {isGenerating ? (
                    <div className="flex flex-col items-center gap-3 animate-pulse">
                        <Loader2 size={32} className="animate-spin text-purple-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-purple-500">{UI_STRINGS.studio.generating}</span>
                    </div>
                ) : generatedImage ? (
                    <>
                        <img src={`data:image/png;base64,${generatedImage}`} className="w-full h-full object-cover animate-in fade-in zoom-in duration-500" />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors pointer-events-none" />
                        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                            <div className="w-12 h-8 rounded-lg bg-white/20 backdrop-blur-md" />
                            <div className="text-white font-mono tracking-widest opacity-80 text-lg">•••• ••••</div>
                        </div>
                    </>
                ) : (
                    <div className="text-center text-slate-400">
                        <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs font-bold">Preview Area</p>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold border border-rose-100 flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}
            
            <p className="text-[9px] text-center text-slate-400 font-medium">
                {UI_STRINGS.studio.hint}
            </p>

            <div className="flex gap-3 pt-2">
                {generatedImage ? (
                    <>
                        <button 
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={14} />
                            <span>{UI_STRINGS.studio.try_again}</span>
                        </button>
                        <button 
                            onClick={() => onApply(generatedImage)}
                            className="flex-[2] py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-95"
                        >
                            <CheckCircle2 size={16} />
                            <span>{UI_STRINGS.studio.apply_skin}</span>
                        </button>
                    </>
                ) : (
                    <button 
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition-all shadow-xl shadow-purple-500/30 active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                    >
                        <Sparkles size={16} />
                        <span>{UI_STRINGS.studio.generate_btn}</span>
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default CardArtStudio;
