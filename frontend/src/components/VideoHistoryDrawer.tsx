import React, { useEffect, useState } from 'react';
import {
  Archive,
  Check,
  CirclePlay,
  Flame,
  LibraryBig,
  LoaderCircle,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import type { VideoData } from './VideoPlayer';

interface QueuedItem {
  id: string;
  title: string;
  play_url: string;
  author: string;
  views: number;
  likes: number;
  music_title: string;
  niche: string;
  used: number;
  created_at: string;
}

interface VideoHistoryDrawerProps {
  videos: VideoData[];
  selectedVideoId: string | null;
  onSelectVideo: (video: VideoData, customList?: VideoData[]) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const SEARCH_PRESETS = [
  { label: 'Flight deck', value: 'cockpit takeoff landing atc aviation' },
  { label: 'Engineering', value: 'aircraft engineering turbine aviation maintenance' },
  { label: 'History', value: 'aviation history vintage aircraft flight archive' },
  { label: 'Rare moments', value: 'aviation rare crosswind emergency aircraft carrier' },
];

const compact = (value: number) => {
  if (!value) return '—';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
};

export const VideoHistoryDrawer: React.FC<VideoHistoryDrawerProps> = ({
  videos,
  selectedVideoId,
  onSelectVideo,
  onRefresh,
  isRefreshing = false,
}) => {
  const [tab, setTab] = useState<'library' | 'inbox'>('library');
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [isMining, setIsMining] = useState(false);
  const [batchCount, setBatchCount] = useState(20);
  const [query, setQuery] = useState(SEARCH_PRESETS[0].value);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchQueue = async () => {
    try {
      const response = await fetch(`/api/queue?t=${Date.now()}`);
      if (response.ok) setQueue(await response.json());
    } catch (error) {
      console.warn('Content inbox is unavailable:', error);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  const handleMine = async () => {
    setIsMining(true);
    setNotice(null);
    try {
      const response = await fetch('/api/batch-mine-tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, count: batchCount, niche: 'aviation' }),
      });
      const data = await response.json() as { success?: boolean; insertedCount?: number; countRetrieved?: number; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || 'No source assets were returned');
      await fetchQueue();
      setNotice(`${data.insertedCount || data.countRetrieved || 0} source assets added to the inbox.`);
    } catch (error: any) {
      setNotice(error.message || 'Could not update the source inbox.');
    } finally {
      setIsMining(false);
      window.setTimeout(() => setNotice(null), 4500);
    }
  };

  const chooseQueueItem = (item: QueuedItem) => {
    if (!item.play_url) return;
    const playlist: VideoData[] = queue.filter((entry) => entry.play_url).map((entry) => ({
      id: entry.id,
      url: `/api/stream-proxy?url=${encodeURIComponent(entry.play_url)}`,
      title: entry.title || 'Untitled source asset',
      channel: entry.author || 'creator',
      likes: compact(entry.likes),
      comments: '—',
      shares: '—',
    }));
    onSelectVideo({
      id: item.id,
      url: `/api/stream-proxy?url=${encodeURIComponent(item.play_url)}`,
      title: item.title || 'Untitled source asset',
      channel: item.author || 'creator',
      likes: compact(item.likes),
      comments: '—',
      shares: '—',
    }, playlist);
  };

  const freshCount = queue.filter((item) => item.used === 0).length;

  return (
    <div className="content-library">
      <div className="panel-heading">
        <div>
          <span className="eyebrow"><LibraryBig size={14} /> Assets</span>
          <h2>Content library</h2>
        </div>
        <button className="refresh-library" type="button" onClick={() => { onRefresh?.(); fetchQueue(); }} disabled={isRefreshing} aria-label="Refresh library">
          <RefreshCw size={15} className={isRefreshing ? 'spin-icon' : ''} />
        </button>
      </div>

      <div className="library-tabs" role="tablist" aria-label="Asset collections">
        <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')} role="tab" aria-selected={tab === 'library'}><Archive size={14} /> Exports <span>{videos.length}</span></button>
        <button className={tab === 'inbox' ? 'active' : ''} onClick={() => { setTab('inbox'); fetchQueue(); }} role="tab" aria-selected={tab === 'inbox'}><Flame size={14} /> Source inbox <span>{freshCount}</span></button>
      </div>

      {tab === 'library' ? (
        <div className="asset-scroll">
          <div className="library-intro"><span><Sparkles size={14} /> Finalised videos</span><p>Rendered, original releases ready for review or distribution.</p></div>
          {videos.length ? videos.map((video, index) => (
            <button
              type="button"
              key={video.id}
              onClick={() => onSelectVideo(video)}
              className={selectedVideoId === video.id ? 'asset-row selected' : 'asset-row'}
            >
              <span className="asset-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="asset-poster"><CirclePlay size={18} /></span>
              <span className="asset-copy"><strong>{video.title}</strong><small>@{video.channel}</small></span>
              {selectedVideoId === video.id ? <span className="asset-check"><Check size={14} /></span> : <span className="asset-type">MP4</span>}
            </button>
          )) : <div className="empty-library"><Archive size={22} /><strong>Nothing in the library yet</strong><span>Your first exported release will appear here.</span></div>}
        </div>
      ) : (
        <div className="inbox-flow">
          <div className="source-search">
            <div className="field-heading"><label htmlFor="source-query">Source intake</label><span>Batch discovery</span></div>
            <div className="source-preset-row">
              {SEARCH_PRESETS.map((preset) => <button key={preset.label} onClick={() => setQuery(preset.value)} className={query === preset.value ? 'active' : ''} type="button">{preset.label}</button>)}
            </div>
            <div className="search-input-wrap"><Search size={15} /><input id="source-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Describe the source footage you need" /></div>
            <div className="intake-actions"><select value={batchCount} onChange={(event) => setBatchCount(Number(event.target.value))} aria-label="Source count"><option value={10}>10 assets</option><option value={20}>20 assets</option><option value={30}>30 assets</option></select><button type="button" onClick={handleMine} disabled={isMining || !query.trim()}>{isMining ? <LoaderCircle size={15} className="spin-icon" /> : <Sparkles size={15} />} {isMining ? 'Sourcing' : 'Source assets'}</button></div>
          </div>

          {notice && <div className="inbox-notice">{notice}</div>}
          <div className="inbox-scroll">
            {queue.length ? queue.map((item, index) => (
              <button type="button" key={item.id} onClick={() => chooseQueueItem(item)} className={item.used ? 'inbox-row used' : 'inbox-row'}>
                <span className="inbox-poster"><Flame size={16} /></span>
                <span className="inbox-copy"><strong>{item.title || 'Untitled source asset'}</strong><small>@{item.author || 'creator'} · {compact(item.views)} views</small></span>
                <span className={item.used ? 'inbox-status used' : 'inbox-status'}>{item.used ? 'Released' : `#${String(index + 1).padStart(2, '0')}`}</span>
              </button>
            )) : <div className="empty-library"><Flame size={22} /><strong>Your source inbox is clear</strong><span>Search for the next batch of aviation material above.</span></div>}
          </div>
        </div>
      )}
    </div>
  );
};
