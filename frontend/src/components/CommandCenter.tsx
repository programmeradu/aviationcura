import React, { useState, useEffect } from 'react';
import {
  Send,
  Check,
  Copy,
  Layers,
  Radio,
  Film,
  Sparkles,
  Volume2
} from 'lucide-react';
import type { VideoData } from './VideoPlayer';

interface CommandCenterProps {
  currentVideo: VideoData | null;
  activeNiche?: string;
  onSelectNiche?: (niche: string) => void;
  isTriggering?: boolean;
  captionText: string;
  onChangeCaption: (newCaption: string) => void;
  onVideoGenerated?: () => void;
}

interface TopicPreset {
  id: string;
  title: string;
  summary: string;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  currentVideo,
  captionText,
  onChangeCaption,
  onVideoGenerated
}) => {
  const [activeTab, setActiveTab] = useState<'curator' | 'minidoc'>('minidoc');
  const [copied, setCopied] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  // Mini-Doc Studio state
  const [topics, setTopics] = useState<TopicPreset[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [voice, setVoice] = useState('en-US-ChristopherNeural');
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [docProgress, setDocProgress] = useState<string | null>(null);
  const [generatedDoc, setGeneratedDoc] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/documentary-topics')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTopics(data);
          if (data.length > 0) setSelectedTopic(data[0].title);
        }
      })
      .catch(() => {});
  }, []);

  const handleGenerateDocumentary = async () => {
    const topicToUse = customTopic.trim() || selectedTopic;
    if (!topicToUse) return;

    setIsGeneratingDoc(true);
    setDocProgress('Writing 60s documentary script via Workers AI...');

    try {
      setTimeout(() => {
        setDocProgress('Synthesizing broadcast neural voiceover & word timings...');
      }, 3500);

      setTimeout(() => {
        setDocProgress('Rendering 1080x1920 video with kinetic subtitles in Container...');
      }, 7000);

      const res = await fetch('/api/generate-documentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicToUse,
          voice
        })
      });

      const data = await res.json() as any;

      if (res.ok && data.success) {
        setGeneratedDoc(data);
        setDocProgress('✨ Documentary rendered and saved to R2!');
        onChangeCaption(data.caption);
        if (onVideoGenerated) onVideoGenerated();
      } else {
        setDocProgress(`Error: ${data.error || 'Rendering failed'}`);
      }
    } catch (e: any) {
      setDocProgress(`Exception: ${e.message}`);
    } finally {
      setIsGeneratingDoc(false);
      setTimeout(() => setDocProgress(null), 8000);
    }
  };

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(captionText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualDispatch = async (platform: 'telegram' | 'tiktok') => {
    const videoIdToPost = generatedDoc?.videoId || currentVideo?.id;
    if (!videoIdToPost) {
      setDispatchStatus('Error: No video ready to post');
      setTimeout(() => setDispatchStatus(null), 3000);
      return;
    }

    setIsPosting(true);
    setDispatchStatus(`Publishing to ${platform === 'tiktok' ? 'TikTok (@aloyacy)' : 'Telegram'}...`);

    try {
      const endpoint = platform === 'tiktok' ? '/api/publish-tiktok' : '/api/publish-telegram';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: videoIdToPost,
          caption: captionText || currentVideo?.title || '✈️ Aviation Documentary'
        })
      });

      const data = await res.json() as any;
      if (res.ok && (data.success || data.post || data.id)) {
        setDispatchStatus(`Successfully published to ${platform === 'tiktok' ? 'TikTok (@aloyacy)' : 'Telegram'}!`);
      } else {
        setDispatchStatus(`Failed: ${data.error || 'Check server logs'}`);
      }
    } catch (err: any) {
      setDispatchStatus(`Error: ${err.message}`);
    } finally {
      setIsPosting(false);
      setTimeout(() => setDispatchStatus(null), 5000);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4 p-4 lg:p-6 text-neutral-200">
      {/* Tab Selector */}
      <div className="flex border-b border-[#27272a] pb-2 space-x-4">
        <button
          onClick={() => setActiveTab('minidoc')}
          className={`text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 pb-1 transition-colors ${
            activeTab === 'minidoc' ? 'text-white border-b-2 border-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Film size={14} className="text-amber-400" />
          <span>AI Mini-Doc Studio (100% Original)</span>
        </button>
        <button
          onClick={() => setActiveTab('curator')}
          className={`text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 pb-1 transition-colors ${
            activeTab === 'curator' ? 'text-white border-b-2 border-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Layers size={14} />
          <span>Manual Publishing</span>
        </button>
      </div>

      {/* Real-time Status Alert */}
      {(dispatchStatus || docProgress) && (
        <div className="p-3 rounded-md bg-[#161616] border border-[#27272a] text-neutral-200 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles size={14} className="text-amber-400 animate-spin" />
            <span>{docProgress || dispatchStatus}</span>
          </div>
        </div>
      )}

      {/* ─── TAB 1: AI MINI-DOC STUDIO ──────────────────────────────── */}
      {activeTab === 'minidoc' && (
        <div className="space-y-4 flex-1 flex flex-col">
          {/* Preset Topics */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center justify-between">
              <span>Aviation Mystery & Disaster Presets</span>
              <span className="text-amber-400">⚡ FYP Strike-Proof</span>
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
              {topics.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTopic(t.title);
                    setCustomTopic('');
                  }}
                  className={`p-2.5 rounded text-left border text-xs transition-all ${
                    selectedTopic === t.title && !customTopic
                      ? 'bg-white/10 border-white text-white'
                      : 'bg-[#121212] border-[#27272a] text-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  <div className="font-semibold">{t.title}</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">{t.summary}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Topic Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
              Or Custom Topic / Flight Number
            </label>
            <input
              type="text"
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              placeholder="e.g. MH370 mysterious left turn over Andaman Sea..."
              className="w-full bg-[#121212] border border-[#27272a] rounded px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white"
            />
          </div>

          {/* Voice Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center space-x-2">
              <Volume2 size={12} />
              <span>Broadcast Neural Voice</span>
            </label>
            <select
              value={voice}
              onChange={e => setVoice(e.target.value)}
              className="w-full bg-[#121212] border border-[#27272a] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
            >
              <option value="en-US-ChristopherNeural">Christopher (Authoritative Documentary)</option>
              <option value="en-US-EricNeural">Eric (Intense & Dramatic Storytelling)</option>
              <option value="en-GB-RyanNeural">Ryan (BBC Documentary Tone)</option>
              <option value="en-US-GuyNeural">Guy (Engaging Casual Narrator)</option>
            </select>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateDocumentary}
            disabled={isGeneratingDoc}
            className={`w-full py-3 rounded-md font-semibold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
              isGeneratingDoc
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : 'bg-white text-black hover:bg-neutral-200 active:scale-[0.99] shadow-lg shadow-white/10'
            }`}
          >
            <Sparkles size={16} className={isGeneratingDoc ? 'animate-spin' : 'text-amber-500'} />
            <span>{isGeneratingDoc ? 'Rendering 100% Original Mini-Doc...' : '⚡ Generate 60s Mini-Doc & Subtitles'}</span>
          </button>

          {/* Generated Result Card */}
          {generatedDoc && (
            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="text-xs font-semibold text-amber-300 flex items-center justify-between">
                <span>✅ Ready for Publishing</span>
                <span className="font-mono text-[10px]">{generatedDoc.videoId}</span>
              </div>
              <p className="text-[11px] text-neutral-300 italic line-clamp-2">"{generatedDoc.script}"</p>
              <div className="flex space-x-2 pt-1">
                <button
                  onClick={() => handleManualDispatch('tiktok')}
                  disabled={isPosting}
                  className="flex-1 py-2 bg-black hover:bg-neutral-900 text-white rounded text-xs font-semibold border border-white/20 flex items-center justify-center space-x-1"
                >
                  <Send size={12} />
                  <span>Post to TikTok</span>
                </button>
                <button
                  onClick={() => handleManualDispatch('telegram')}
                  disabled={isPosting}
                  className="flex-1 py-2 bg-[#229ED9]/20 hover:bg-[#229ED9]/30 text-[#229ED9] rounded text-xs font-semibold border border-[#229ED9]/40 flex items-center justify-center space-x-1"
                >
                  <Radio size={12} />
                  <span>Telegram</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: MANUAL PUBLISHING & CAPTIONS ────────────────────── */}
      {activeTab === 'curator' && (
        <div className="space-y-4 flex-1 flex flex-col">
          {/* Caption Editor */}
          <div className="space-y-2 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center space-x-1">
                <span>TikTok Caption & Hook</span>
              </label>
              <button
                onClick={handleCopyCaption}
                className="text-[11px] text-neutral-400 hover:text-white flex items-center space-x-1"
              >
                {copied ? <Check size={12} className="text-white" /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <textarea
              value={captionText}
              onChange={e => onChangeCaption(e.target.value)}
              className="w-full flex-1 min-h-[140px] bg-[#121212] border border-[#27272a] rounded p-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white leading-relaxed resize-none"
              placeholder="Edit caption text here..."
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleManualDispatch('tiktok')}
              disabled={isPosting || !currentVideo}
              className="py-3 bg-white text-black hover:bg-neutral-200 disabled:opacity-40 rounded font-semibold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all"
            >
              <Send size={14} />
              <span>Post to TikTok</span>
            </button>
            <button
              onClick={() => handleManualDispatch('telegram')}
              disabled={isPosting || !currentVideo}
              className="py-3 bg-[#161616] border border-[#27272a] hover:border-neutral-400 disabled:opacity-40 text-white rounded font-semibold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all"
            >
              <Radio size={14} />
              <span>Telegram</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
