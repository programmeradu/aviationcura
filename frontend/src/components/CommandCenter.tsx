import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  FileText,
  Film,
  LoaderCircle,
  Radio,
  Send,
  Sparkles,
  Volume2,
  WandSparkles,
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

const NICHE_OPTIONS = [
  { id: 'aviation', label: 'Aviation' },
  { id: 'aviation_history', label: 'Aviation history' },
  { id: 'aviation_mysteries', label: 'Flight mysteries' },
];

export const CommandCenter: React.FC<CommandCenterProps> = ({
  currentVideo,
  activeNiche = 'aviation',
  onSelectNiche,
  captionText,
  onChangeCaption,
  onVideoGenerated,
}) => {
  const [tab, setTab] = useState<'create' | 'release'>('create');
  const [topics, setTopics] = useState<TopicPreset[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [voice, setVoice] = useState('athena');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [generatedDoc, setGeneratedDoc] = useState<any | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/documentary-topics')
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTopics(data);
          setSelectedTopic(data[0]?.title || '');
        }
      })
      .catch(() => setTopics([]));
  }, []);

  const handleGenerate = async () => {
    const topic = customTopic.trim() || selectedTopic;
    if (!topic) return;
    setIsGenerating(true);
    setProgress('Drafting a concise 35–45 second narrative');

    const voiceTimer = window.setTimeout(() => setProgress('Preparing broadcast voice and timed captions'), 3000);
    const renderTimer = window.setTimeout(() => setProgress('Rendering a 9:16 original export'), 6500);

    try {
      const response = await fetch('/api/generate-documentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, voice }),
      });
      const data = await response.json() as any;
      if (!response.ok || !data.success) throw new Error(data.error || 'Render could not be started');
      setGeneratedDoc(data);
      setProgress('Original documentary is ready for release');
      onChangeCaption(data.caption || '');
      onVideoGenerated?.();
      setTab('release');
    } catch (error: any) {
      setProgress(error.message || 'The generation service is unavailable');
    } finally {
      window.clearTimeout(voiceTimer);
      window.clearTimeout(renderTimer);
      setIsGenerating(false);
      window.setTimeout(() => setProgress(null), 7000);
    }
  };

  const dispatch = async (platform: 'telegram' | 'tiktok') => {
    const videoId = generatedDoc?.videoId || currentVideo?.id;
    if (!videoId) {
      setDispatchStatus('Select or generate an export before publishing.');
      return;
    }

    setIsPosting(true);
    setDispatchStatus(`Sending to ${platform === 'tiktok' ? 'TikTok' : 'Telegram'}…`);
    try {
      const endpoint = platform === 'tiktok' ? '/api/publish-tiktok' : '/api/publish-telegram';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          caption: captionText || currentVideo?.title || 'AviationCura original release',
        }),
      });
      const data = await response.json() as any;
      if (!response.ok || !(data.success || data.post || data.id)) throw new Error(data.error || 'Publishing did not complete');
      setDispatchStatus(`Published to ${platform === 'tiktok' ? 'TikTok' : 'Telegram'}.`);
    } catch (error: any) {
      setDispatchStatus(error.message || 'Publishing failed. Check the configured channel.');
    } finally {
      setIsPosting(false);
      window.setTimeout(() => setDispatchStatus(null), 5000);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(captionText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="command-center">
      <div className="panel-heading">
        <div>
          <span className="eyebrow"><WandSparkles size={14} /> Production</span>
          <h2>Release control</h2>
        </div>
        <span className="content-chip">9:16</span>
      </div>

      <div className="segmented-control" role="tablist" aria-label="Production tools">
        <button className={tab === 'create' ? 'selected' : ''} onClick={() => setTab('create')} role="tab" aria-selected={tab === 'create'}><Sparkles size={14} /> Create</button>
        <button className={tab === 'release' ? 'selected' : ''} onClick={() => setTab('release')} role="tab" aria-selected={tab === 'release'}><Send size={14} /> Release</button>
      </div>

      {(progress || dispatchStatus) && (
        <div className="studio-notice" role="status">
          {isGenerating || isPosting ? <LoaderCircle size={15} className="spin-icon" /> : <Check size={15} />}
          <span>{progress || dispatchStatus}</span>
        </div>
      )}

      {tab === 'create' ? (
        <div className="create-flow">
          <div className="field-group">
            <div className="field-heading"><label htmlFor="format">Series format</label><span>Original</span></div>
            <div className="select-shell">
              <select id="format" value={activeNiche} onChange={(event) => onSelectNiche?.(event.target.value)}>
                {NICHE_OPTIONS.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
              </select>
              <ChevronDown size={15} />
            </div>
          </div>

          <div className="field-group">
            <div className="field-heading"><label>Suggested brief</label><span>{topics.length} ready</span></div>
            <div className="topic-list">
              {topics.slice(0, 4).map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => { setSelectedTopic(topic.title); setCustomTopic(''); }}
                  className={selectedTopic === topic.title && !customTopic ? 'topic-card is-selected' : 'topic-card'}
                >
                  <Film size={15} />
                  <span><strong>{topic.title}</strong><small>{topic.summary}</small></span>
                </button>
              ))}
              {!topics.length && <div className="topic-empty">No editorial prompts are currently available.</div>}
            </div>
          </div>

          <div className="field-group">
            <div className="field-heading"><label htmlFor="custom-topic">Or write a brief</label><span>Optional</span></div>
            <textarea
              id="custom-topic"
              value={customTopic}
              onChange={(event) => setCustomTopic(event.target.value)}
              placeholder="For example: How pilots read a fast-moving storm cell on final approach"
              rows={3}
            />
          </div>

          <div className="field-group">
            <div className="field-heading"><label htmlFor="voice">Narration</label><Volume2 size={14} /></div>
            <div className="select-shell">
              <select id="voice" value={voice} onChange={(event) => setVoice(event.target.value)}>
                <option value="athena">Athena — calm cinematic storytelling</option>
                <option value="orion">Orion — warm informative delivery</option>
                <option value="hera">Hera — polished editorial narration</option>
              </select>
              <ChevronDown size={15} />
            </div>
          </div>

          <button className="primary-action" onClick={handleGenerate} disabled={isGenerating || (!customTopic.trim() && !selectedTopic)} type="button">
            {isGenerating ? <LoaderCircle size={17} className="spin-icon" /> : <Sparkles size={17} />}
            <span>{isGenerating ? 'Creating your release' : 'Create original mini-documentary'}</span>
          </button>
          <p className="form-footnote">A narrated original with timed subtitles will be added to your release library.</p>
        </div>
      ) : (
        <div className="release-flow">
          <div className="release-asset-card">
            <div className="release-asset-icon"><FileText size={19} /></div>
            <div><span>Selected export</span><strong>{generatedDoc?.videoId ? 'New original documentary' : currentVideo?.title || 'No asset selected'}</strong></div>
            <span className="asset-ready"><i /> Ready</span>
          </div>

          <div className="field-group caption-group">
            <div className="field-heading"><label htmlFor="caption">Caption</label><button onClick={handleCopy} type="button">{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}</button></div>
            <textarea id="caption" value={captionText} onChange={(event) => onChangeCaption(event.target.value)} placeholder="Write the context that earns the pause." rows={7} />
            <div className="caption-meta"><span>{captionText.length} characters</span><span>Curator perspective</span></div>
          </div>

          <div className="distribution-section">
            <div className="field-heading"><label>Distribution</label><span>Connected channels</span></div>
            <button className="distribution-button tiktok" onClick={() => dispatch('tiktok')} disabled={isPosting || !currentVideo && !generatedDoc} type="button"><span className="distribution-mark">T</span><span><strong>Publish to TikTok</strong><small>Primary channel</small></span><Send size={16} /></button>
            <button className="distribution-button telegram" onClick={() => dispatch('telegram')} disabled={isPosting || !currentVideo && !generatedDoc} type="button"><span className="distribution-mark">T</span><span><strong>Send to Telegram</strong><small>Community channel</small></span><Radio size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
};
