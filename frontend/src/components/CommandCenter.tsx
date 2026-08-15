import React, { useState } from 'react';
import {
  Send,
  Download,
  Check,
  Copy,
  Layers,
  Wand2,
  Radio
} from 'lucide-react';
import type { VideoData } from './VideoPlayer';

interface CommandCenterProps {
  currentVideo: VideoData | null;
  activeNiche: string;
  onSelectNiche: (niche: string) => void;
  isTriggering: boolean;
  captionText: string;
  onChangeCaption: (newCaption: string) => void;
}

const NICHES = [
  { id: 'aviation', name: 'Aviation & Jets', icon: '✈️', tag: '#aviation' },
  { id: 'tech_gadgets', name: 'Tech & Gadgets', icon: '⚡', tag: '#techfinds' },
  { id: 'oddly_satisfying', name: 'Oddly Satisfying', icon: '🧼', tag: '#asmr' },
  { id: 'dark_psychology', name: 'Psychology Secrets', icon: '🧠', tag: '#mindset' },
  { id: 'luxury_lifestyle', name: 'Luxury Lifestyle', icon: '💎', tag: '#luxury' }
];

export const CommandCenter: React.FC<CommandCenterProps> = ({
  currentVideo,
  activeNiche,
  onSelectNiche,
  isTriggering,
  captionText,
  onChangeCaption
}) => {
  const [copied, setCopied] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(captionText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualDispatch = (platform: 'telegram' | 'tiktok') => {
    setDispatchStatus(`Dispatching to ${platform === 'telegram' ? 'Telegram' : 'TikTok (Draft)'}...`);
    setTimeout(() => {
      setDispatchStatus(`Successfully pushed to ${platform === 'telegram' ? 'Telegram Channel' : 'TikTok Private Draft'}!`);
      setTimeout(() => setDispatchStatus(null), 3000);
    }, 1200);
  };

  const charCount = captionText.length;
  const isOverLimit = charCount > 220;

  return (
    <div className="h-full flex flex-col space-y-5 overflow-y-auto p-4 lg:p-6 text-neutral-200">
      {/* Real-time Status Alert / Banner */}
      {dispatchStatus && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <Check size={16} className="text-emerald-400" />
            <span>{dispatchStatus}</span>
          </div>
        </div>
      )}

      {/* Live Pipeline Stepper */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-white/5 shadow-xl">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center space-x-2">
            <Radio size={16} className={isTriggering ? "text-rose-500 animate-pulse" : "text-neutral-500"} />
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">Automated Pipeline Status</h2>
          </div>
          <span className="text-[11px] text-neutral-400 font-mono">
            {isTriggering ? 'Phase: Processing...' : 'Phase: Idle / Ready'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className={`p-2.5 rounded-xl text-center border transition-all ${isTriggering ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400'}`}>
            <span className="text-[10px] block text-neutral-500 font-mono">STEP 1</span>
            <span className="text-xs font-semibold">YouTube Discovery</span>
          </div>
          <div className={`p-2.5 rounded-xl text-center border transition-all ${isTriggering ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400'}`}>
            <span className="text-[10px] block text-neutral-500 font-mono">STEP 2</span>
            <span className="text-xs font-semibold">Llama AI Hook</span>
          </div>
          <div className={`p-2.5 rounded-xl text-center border transition-all ${isTriggering ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400'}`}>
            <span className="text-[10px] block text-neutral-500 font-mono">STEP 3</span>
            <span className="text-xs font-semibold">FFmpeg Obfuscate</span>
          </div>
          <div className={`p-2.5 rounded-xl text-center border transition-all ${isTriggering ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400'}`}>
            <span className="text-[10px] block text-neutral-500 font-mono">STEP 4</span>
            <span className="text-xs font-semibold">R2 & TikTok Dispatch</span>
          </div>
        </div>
      </div>

      {/* Niche Selector */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-white/5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
            <Layers size={16} className="text-pink-400" />
            <span>Target Niche</span>
          </h2>
          <span className="text-[11px] text-neutral-400">Select active category</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {NICHES.map((niche) => {
            const isSelected = activeNiche.toLowerCase() === niche.id.toLowerCase();
            return (
              <button
                key={niche.id}
                onClick={() => onSelectNiche(niche.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 scale-[1.02]'
                    : 'bg-neutral-900/90 text-neutral-300 hover:bg-neutral-800 border border-neutral-800'
                }`}
              >
                <span>{niche.icon}</span>
                <span>{niche.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Caption Studio & Editor */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-white/5 shadow-xl flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
            <Wand2 size={16} className="text-amber-400" />
            <span>AI Caption Studio</span>
          </h2>
          <div className="flex items-center space-x-2">
            <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-md ${isOverLimit ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-neutral-800 text-neutral-400'}`}>
              {charCount}/220 chars
            </span>
            <button
              onClick={handleCopyCaption}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition cursor-pointer"
              title="Copy caption"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        <textarea
          value={captionText}
          onChange={(e) => onChangeCaption(e.target.value)}
          placeholder="AI-generated hook caption will appear here..."
          rows={4}
          className="w-full bg-neutral-950/80 rounded-xl p-3.5 text-xs text-neutral-100 placeholder-neutral-500 border border-neutral-800 focus:border-rose-500/50 focus:outline-none focus:ring-1 focus:ring-rose-500/30 transition resize-none leading-relaxed"
        />

        {/* Video Metadata Inspector */}
        {currentVideo && (
          <div className="mt-3.5 pt-3.5 border-t border-neutral-800/80 flex flex-wrap items-center justify-between text-[11px] text-neutral-400 gap-2">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-neutral-300">Source:</span>
              <span className="truncate max-w-[180px] text-neutral-400">@{currentVideo.channel}</span>
            </div>
            <div className="flex items-center space-x-3">
              <span>❤️ {currentVideo.likes}</span>
              <span>💬 {currentVideo.comments}</span>
              <span>🔄 {currentVideo.shares}</span>
            </div>
          </div>
        )}
      </div>

      {/* Manual Dispatch Center */}
      <div className="glass-card rounded-2xl p-4 sm:p-5 border border-white/5 shadow-xl">
        <h2 className="text-sm font-bold text-white tracking-wide uppercase mb-3 flex items-center gap-2">
          <Send size={16} className="text-cyan-400" />
          <span>Manual Dispatch</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            onClick={() => handleManualDispatch('tiktok')}
            className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-neutral-900 to-neutral-800 hover:from-neutral-800 hover:to-neutral-700 text-neutral-100 border border-neutral-700 font-semibold text-xs transition cursor-pointer shadow-sm active:scale-95"
          >
            <span>📱</span>
            <span>TikTok (Private Draft)</span>
          </button>

          <button
            onClick={() => handleManualDispatch('telegram')}
            className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-600/30 to-blue-600/30 hover:from-sky-600/40 hover:to-blue-600/40 text-sky-200 border border-sky-500/30 font-semibold text-xs transition cursor-pointer shadow-sm active:scale-95"
          >
            <span>✈️</span>
            <span>Send to Telegram</span>
          </button>

          {currentVideo && (
            <a
              href={currentVideo.url}
              download={`${currentVideo.id}.mp4`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 font-semibold text-xs transition cursor-pointer shadow-sm active:scale-95"
            >
              <Download size={14} />
              <span>Download MP4</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
