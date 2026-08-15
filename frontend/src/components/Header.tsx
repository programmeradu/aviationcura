import React from 'react';
import { RefreshCw, Zap, Video, ShieldCheck, Activity } from 'lucide-react';

interface HeaderProps {
  onTriggerRun: () => void;
  isTriggering: boolean;
  totalCurated: number;
  activeNiche: string;
}

export const Header: React.FC<HeaderProps> = ({
  onTriggerRun,
  isTriggering,
  totalCurated,
  activeNiche
}) => {
  return (
    <header className="w-full glass-panel border-b border-white/10 px-4 lg:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Status */}
      <div className="flex items-center space-x-3.5">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 text-white shadow-lg shadow-rose-500/20">
          <Zap size={18} className="fill-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold tracking-tight text-white">Curator Studio</h1>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Pipeline
            </span>
          </div>
          <p className="text-xs text-neutral-400 hidden sm:block">Automated 9:16 Viral Content Curation Engine</p>
        </div>
      </div>

      {/* Metrics & Action */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Niche Badge */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-xs">
          <Activity size={14} className="text-rose-400" />
          <span className="text-neutral-400">Niche:</span>
          <span className="font-semibold text-neutral-200 capitalize">{activeNiche.replace('_', ' ')}</span>
        </div>

        {/* Count Badge */}
        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-xs">
          <Video size={14} className="text-cyan-400" />
          <span className="text-neutral-400">Curated:</span>
          <span className="font-semibold text-neutral-200">{totalCurated} videos</span>
        </div>

        {/* Anti-Strike Badge */}
        <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs text-emerald-300">
          <ShieldCheck size={14} />
          <span>FFmpeg Obfuscated</span>
        </div>

        {/* Manual Trigger Button */}
        <button
          onClick={onTriggerRun}
          disabled={isTriggering}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold text-xs transition-all shadow-md active:scale-95 ${
            isTriggering
              ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed border border-neutral-700'
              : 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white shadow-rose-500/25 hover:shadow-rose-500/40 cursor-pointer'
          }`}
        >
          <RefreshCw size={14} className={isTriggering ? 'animate-spin' : ''} />
          <span>{isTriggering ? 'Running Pipeline...' : 'Trigger Run'}</span>
        </button>
      </div>
    </header>
  );
};
