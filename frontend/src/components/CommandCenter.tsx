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
  { id: 'cyprus_tourism', name: 'Cyprus Tourism', icon: '🏛️' },
  { id: 'cyprus_lifestyle', name: 'Cyprus Lifestyle', icon: '🌊' },
  { id: 'aviation', name: 'Aviation', icon: '✈️' },
  { id: 'tech_gadgets', name: 'Tech Gadgets', icon: '⚡' },
  { id: 'oddly_satisfying', name: 'Oddly Satisfying', icon: '🧼' },
  { id: 'dark_psychology', name: 'Psychology', icon: '🧠' },
  { id: 'luxury_lifestyle', name: 'Luxury', icon: '💎' }
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
    setDispatchStatus(`Dispatching to ${platform === 'telegram' ? 'Telegram' : 'TikTok (Private Draft)'}...`);
    setTimeout(() => {
      setDispatchStatus(`Pushed to ${platform === 'telegram' ? 'Telegram' : 'TikTok Private Draft'} successfully.`);
      setTimeout(() => setDispatchStatus(null), 3000);
    }, 1000);
  };

  const charCount = captionText.length;
  const isOverLimit = charCount > 220;

  return (
    <div className="h-full flex flex-col space-y-4 p-4 lg:p-6 text-neutral-200">
      {/* Real-time Status Alert */}
      {dispatchStatus && (
        <div className="p-3 rounded-md bg-[#161616] border border-[#27272a] text-neutral-200 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Check size={14} className="text-white" />
            <span>{dispatchStatus}</span>
          </div>
        </div>
      )}

      {/* Automated Pipeline Status */}
      <div className="flat-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Radio size={14} className={isTriggering ? 'text-white animate-pulse' : 'text-neutral-500'} />
            <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider font-mono">
              Pipeline Stage
            </h2>
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">
            {isTriggering ? 'ACTIVE PROCESSING' : 'STANDBY'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
          <div
            className={`p-2.5 rounded-lg border text-center transition-colors ${
              isTriggering
                ? 'bg-white text-black border-white font-bold'
                : 'bg-[#0d0d0d] border-[#222222] text-neutral-400'
            }`}
          >
            <span className="block text-[9px] text-neutral-500">01</span>
            <span>Discovery</span>
          </div>
          <div
            className={`p-2.5 rounded-lg border text-center transition-colors ${
              isTriggering
                ? 'bg-white text-black border-white font-bold'
                : 'bg-[#0d0d0d] border-[#222222] text-neutral-400'
            }`}
          >
            <span className="block text-[9px] text-neutral-500">02</span>
            <span>AI Caption</span>
          </div>
          <div
            className={`p-2.5 rounded-lg border text-center transition-colors ${
              isTriggering
                ? 'bg-white text-black border-white font-bold'
                : 'bg-[#0d0d0d] border-[#222222] text-neutral-400'
            }`}
          >
            <span className="block text-[9px] text-neutral-500">03</span>
            <span>FFmpeg</span>
          </div>
          <div
            className={`p-2.5 rounded-lg border text-center transition-colors ${
              isTriggering
                ? 'bg-white text-black border-white font-bold'
                : 'bg-[#0d0d0d] border-[#222222] text-neutral-400'
            }`}
          >
            <span className="block text-[9px] text-neutral-500">04</span>
            <span>Dispatch</span>
          </div>
        </div>
      </div>

      {/* Target Niche Selector */}
      <div className="flat-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Layers size={13} className="text-neutral-400" />
            <span>Niches</span>
          </h2>
          <span className="text-[11px] text-neutral-500 font-mono">Select target</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {NICHES.map((niche) => {
            const isSelected = activeNiche.toLowerCase() === niche.id.toLowerCase();
            return (
              <button
                key={niche.id}
                onClick={() => onSelectNiche(niche.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  isSelected
                    ? 'bg-white text-black font-semibold'
                    : 'bg-[#0d0d0d] text-neutral-400 hover:text-white border border-[#222222] hover:border-[#333333]'
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
      <div className="flat-card rounded-xl p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Wand2 size={13} className="text-neutral-400" />
            <span>Caption Inspector</span>
          </h2>
          <div className="flex items-center space-x-2">
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                isOverLimit
                  ? 'bg-neutral-900 text-neutral-200 border-white'
                  : 'bg-[#0d0d0d] text-neutral-400 border-[#222222]'
              }`}
            >
              {charCount}/220
            </span>
            <button
              onClick={handleCopyCaption}
              className="p-1 rounded bg-[#181818] hover:bg-[#252525] border border-[#27272a] text-neutral-300 transition cursor-pointer"
              title="Copy caption"
            >
              {copied ? <Check size={13} className="text-white" /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        <textarea
          value={captionText}
          onChange={(e) => onChangeCaption(e.target.value)}
          placeholder="AI caption..."
          rows={3}
          className="w-full bg-[#080808] rounded-lg p-3 text-xs text-neutral-100 placeholder-neutral-600 border border-[#222222] focus:border-[#444444] focus:outline-none transition resize-none leading-relaxed font-sans"
        />

        {/* Video Attribution */}
        {currentVideo && (
          <div className="mt-2.5 pt-2.5 border-t border-[#1c1c1c] flex items-center justify-between text-[11px] text-neutral-500 font-mono">
            <span className="truncate max-w-[200px]">@{currentVideo.channel}</span>
            <div className="flex items-center space-x-3">
              <span>{currentVideo.likes} likes</span>
              <span>{currentVideo.comments} cmts</span>
            </div>
          </div>
        )}
      </div>

      {/* Manual Dispatch Actions */}
      <div className="flat-card rounded-xl p-4">
        <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider font-mono mb-2.5 flex items-center gap-1.5">
          <Send size={13} className="text-neutral-400" />
          <span>Dispatch Controls</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => handleManualDispatch('tiktok')}
            className="flat-button-secondary py-2 px-3 rounded-md text-xs font-semibold text-center cursor-pointer active:scale-98"
          >
            TikTok (Draft)
          </button>

          <button
            onClick={() => handleManualDispatch('telegram')}
            className="flat-button-secondary py-2 px-3 rounded-md text-xs font-semibold text-center cursor-pointer active:scale-98"
          >
            Telegram
          </button>

          {currentVideo && (
            <a
              href={currentVideo.url}
              download={`${currentVideo.id}.mp4`}
              target="_blank"
              rel="noreferrer"
              className="flat-button-secondary py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer active:scale-98 text-center"
            >
              <Download size={12} />
              <span>Download</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
