import React from 'react';
import { ShieldCheck, HardDrive, CloudOff, EyeOff, ServerOff, Smartphone } from 'lucide-react';
import { UI_STRINGS } from '../locales/en';

interface PrivacyScreenProps {
  onContinue: () => void;
  isOnboarding?: boolean;
}

const PrivacyScreen: React.FC<PrivacyScreenProps> = ({ onContinue, isOnboarding }) => {
  return (
    <div className={`fixed inset-0 z-[80] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-left animate-in fade-in duration-300`}>
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10 animate-in zoom-in duration-300 flex flex-col max-h-[90vh]">
        <div className="p-8 pb-4 flex flex-col items-center text-center shrink-0">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mb-4">
                <ShieldCheck size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{UI_STRINGS.privacy_screen.title}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold mt-2">{UI_STRINGS.privacy_screen.subtitle}</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
            {/* Local Storage */}
            <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <HardDrive className="text-blue-500 shrink-0" size={20} />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                    {UI_STRINGS.privacy_screen.local_storage}
                </p>
            </div>

            {/* No Sync */}
            <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <CloudOff className="text-rose-500 shrink-0" size={20} />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                    {UI_STRINGS.privacy_screen.no_sync}
                </p>
            </div>

            {/* No Access */}
            <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <EyeOff className="text-amber-500 shrink-0" size={20} />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                    {UI_STRINGS.privacy_screen.no_access}
                </p>
            </div>

            {/* AI Privacy */}
            <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <ServerOff className="text-purple-500 shrink-0" size={20} />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                    {UI_STRINGS.privacy_screen.ai_privacy}
                </p>
            </div>

            {/* Data Loss Warning */}
            <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <Smartphone className="text-slate-500 shrink-0" size={20} />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                    {UI_STRINGS.privacy_screen.data_loss}
                </p>
            </div>
        </div>

        <div className="p-6 pt-2 shrink-0">
            <button 
                onClick={onContinue}
                className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/30 active:scale-95 transition-all"
            >
                {isOnboarding ? UI_STRINGS.common.continue : UI_STRINGS.common.close}
            </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyScreen;