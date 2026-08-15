import React from 'react';
import { RefreshCw, Video, ShieldCheck, Activity, Terminal } from 'lucide-react';

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
    <header className="w-full bg-[#0a0a0a] border-b border-[#222222] px-4 lg:px-8 py-3 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Status */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white text-black font-bold">
          <Terminal size={16} />
        </div>
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-sm font-semibold tracking-tight text-white uppercase">Curator Studio</h1>
            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#161616] border border-[#27272a] text-[10px] font-mono text-neutral-300">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              <span>LIVE PIPELINE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics & Actions */}
      <div className="flex items-center space-x-3">
        {/* Niche Badge */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#121212] border border-[#222222] text-xs">
          <Activity size={13} className="text-neutral-400" />
          <span className="text-neutral-500">Niche:</span>
          <span className="font-medium text-neutral-200 capitalize">{activeNiche.replace('_', ' ')}</span>
        </div>

        {/* Total Curated Badge */}
        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-md bg-[#121212] border border-[#222222] text-xs font-mono">
          <Video size={13} className="text-neutral-400" />
          <span className="text-neutral-300">{totalCurated} videos</span>
        </div>

        {/* Anti-Strike Badge */}
        <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-[#121212] border border-[#222222] text-[11px] text-neutral-300 font-mono">
          <ShieldCheck size={13} className="text-neutral-400" />
          <span>OBFUSCATED</span>
        </div>

        {/* Trigger Button */}
        <button
          onClick={onTriggerRun}
          disabled={isTriggering}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md font-semibold text-xs transition cursor-pointer ${
            isTriggering
              ? 'bg-[#1a1a1a] text-neutral-500 border border-[#2a2a2a] cursor-not-allowed'
              : 'flat-button-primary'
          }`}
        >
          <RefreshCw size={13} className={isTriggering ? 'animate-spin' : ''} />
          <span>{isTriggering ? 'Running...' : 'Trigger Run'}</span>
        </button>
      </div>
    </header>
  );
};
