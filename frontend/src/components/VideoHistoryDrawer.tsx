import React, { useState, useEffect } from 'react';
import { Play, Film, Database, RefreshCw, Zap, Flame, CheckCircle2, Clock } from 'lucide-react';
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
  onSelectVideo: (video: VideoData) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const VideoHistoryDrawer: React.FC<VideoHistoryDrawerProps> = ({
  videos,
  selectedVideoId,
  onSelectVideo,
  onRefresh,
  isRefreshing = false
}) => {
  const [tab, setTab] = useState<'archive' | 'queue'>('archive');
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [isMining, setIsMining] = useState(false);
  const [batchCount, setBatchCount] = useState(20);
  const [mineQuery, setMineQuery] = useState('aviation');

  const fetchQueue = async () => {
    try {
      const res = await fetch(`/api/queue?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setQueue(data);
      }
    } catch (e) {
      console.warn("Queue fetch error:", e);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleBatchMine = async () => {
    setIsMining(true);
    try {
      const res = await fetch('/api/batch-mine-tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: mineQuery, count: batchCount, niche: mineQuery })
      });
      const data = await res.json();
      if (data.success) {
        await fetchQueue();
        alert(`Successfully mined ${data.insertedCount || data.countRetrieved} viral videos into D1 Queue!`);
      } else {
        alert(`Mining notice: ${data.error || 'Failed to fetch'}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsMining(false);
    }
  };

  const unusedCount = queue.filter(q => q.used === 0).length;

  return (
    <div className="h-full flex flex-col p-4 lg:p-6 text-neutral-200">
      {/* Header Tabs */}
      <div className="flex items-center justify-between mb-3 border-b border-[#222222] pb-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTab('archive')}
            className={`text-xs font-semibold px-2 py-1 rounded transition font-mono ${
              tab === 'archive'
                ? 'bg-[#222222] text-white'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Archive ({videos.length})
          </button>
          <button
            onClick={() => { setTab('queue'); fetchQueue(); }}
            className={`text-xs font-semibold px-2 py-1 rounded transition font-mono flex items-center space-x-1 ${
              tab === 'queue'
                ? 'bg-amber-950/40 text-amber-300 border border-amber-800/50'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Flame size={12} className="text-amber-400" />
            <span>Mined Queue ({unusedCount})</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => { onRefresh?.(); fetchQueue(); }}
            disabled={isRefreshing}
            className="p-1 rounded bg-[#161616] hover:bg-[#222222] border border-[#27272a] text-neutral-400 hover:text-white transition cursor-pointer"
            title="Sync / Refresh"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {tab === 'archive' ? (
        /* Stored Archive View */
        videos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center flat-card rounded-xl">
            <Film size={24} className="text-neutral-600 mb-2" />
            <p className="text-xs text-neutral-400 font-mono">Archive Empty</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1 flex-1">
            {videos.map((video, idx) => {
              const isSelected = selectedVideoId === video.id;
              return (
                <div
                  key={video.id}
                  onClick={() => onSelectVideo(video)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start space-x-3 group ${
                    isSelected
                      ? 'bg-[#181818] border-white text-white'
                      : 'bg-[#0d0d0d] border-[#222222] hover:bg-[#141414] hover:border-[#333333]'
                  }`}
                >
                  <div className="relative w-12 h-14 rounded bg-[#050505] flex-shrink-0 overflow-hidden border border-[#222222] flex items-center justify-center">
                    <Film size={15} className="text-neutral-500 group-hover:text-white transition" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <Play size={13} className="fill-white text-white" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-neutral-500">#{idx + 1}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#181818] border border-[#27272a] text-neutral-300 font-mono">
                        R2 CACHED
                      </span>
                    </div>

                    <p className="text-xs font-normal text-neutral-200 line-clamp-2 leading-tight group-hover:text-white transition font-sans">
                      {video.title}
                    </p>

                    <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                      <span className="truncate max-w-[120px]">@{video.channel}</span>
                      <span>{video.likes} likes</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Mined TikTok Queue View */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Custom Batch Mining Control Box */}
          <div className="p-3 mb-3 bg-[#111111] border border-[#27272a] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-neutral-400 flex items-center space-x-1">
                <Zap size={12} className="text-amber-400" />
                <span>Pull TikTok Batch (1 API call)</span>
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">Quota-Guard Active</span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={mineQuery}
                onChange={(e) => setMineQuery(e.target.value)}
                placeholder="niche (aviation, asmr)"
                className="flex-1 px-2 py-1 text-xs bg-[#090909] border border-[#27272a] rounded text-white font-mono focus:outline-none focus:border-neutral-400"
              />
              <select
                value={batchCount}
                onChange={(e) => setBatchCount(Number(e.target.value))}
                className="px-2 py-1 text-xs bg-[#090909] border border-[#27272a] rounded text-white font-mono"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
              </select>
              <button
                onClick={handleBatchMine}
                disabled={isMining}
                className="px-3 py-1 bg-white text-black hover:bg-neutral-200 font-mono text-xs font-semibold rounded flex items-center space-x-1 disabled:opacity-50 transition cursor-pointer"
              >
                {isMining ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                <span>{isMining ? 'Pulling...' : 'Pull'}</span>
              </button>
            </div>
          </div>

          {/* Queue Items List */}
          <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1 flex-1">
            {queue.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.play_url) {
                    onSelectVideo({
                      id: item.id,
                      url: item.play_url,
                      title: item.title,
                      channel: item.author || 'tiktok_creator',
                      likes: (item.likes > 1000 ? (item.likes / 1000).toFixed(1) + 'K' : item.likes.toString()),
                      comments: 0,
                      shares: 0
                    });
                  }
                }}
                className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start space-x-3 group ${
                  item.used === 1
                    ? 'bg-[#080808] border-[#181818] opacity-60'
                    : 'bg-[#0d0d0d] border-[#222222] hover:bg-[#141414] hover:border-amber-700/50'
                }`}
              >
                <div className="relative w-12 h-14 rounded bg-[#050505] flex-shrink-0 overflow-hidden border border-[#222222] flex items-center justify-center">
                  <Flame size={15} className={item.used === 1 ? "text-neutral-600" : "text-amber-400 group-hover:scale-110 transition"} />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <Play size={13} className="fill-white text-white" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-neutral-500">#{idx + 1}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono flex items-center space-x-1 ${
                      item.used === 1
                        ? 'bg-[#181818] border border-[#27272a] text-neutral-500'
                        : 'bg-amber-950/40 border border-amber-800/40 text-amber-300'
                    }`}>
                      {item.used === 1 ? <CheckCircle2 size={9} /> : <Clock size={9} />}
                      <span>{item.used === 1 ? 'PUBLISHED' : 'QUEUED'}</span>
                    </span>
                  </div>

                  <p className="text-xs font-normal text-neutral-200 line-clamp-2 leading-tight group-hover:text-white transition font-sans">
                    {item.title || '(No Caption)'}
                  </p>

                  <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                    <span className="truncate max-w-[120px]">@{item.author || 'creator'}</span>
                    <span className="text-amber-400 font-semibold">
                      {item.views > 1000000 ? (item.views / 1000000).toFixed(1) + 'M' : (item.views / 1000).toFixed(0) + 'K'} views
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
