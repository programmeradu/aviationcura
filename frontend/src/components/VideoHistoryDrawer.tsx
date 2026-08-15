import React from 'react';
import { Play, CheckCircle2, Film, Database } from 'lucide-react';
import type { VideoData } from './VideoPlayer';

interface VideoHistoryDrawerProps {
  videos: VideoData[];
  selectedVideoId: string | null;
  onSelectVideo: (video: VideoData) => void;
}

export const VideoHistoryDrawer: React.FC<VideoHistoryDrawerProps> = ({
  videos,
  selectedVideoId,
  onSelectVideo
}) => {
  return (
    <div className="h-full flex flex-col p-4 lg:p-6 text-neutral-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Database size={16} className="text-cyan-400" />
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">Curated Catalog</h2>
        </div>
        <span className="text-xs text-neutral-400 font-mono">{videos.length} videos stored</span>
      </div>

      {videos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center glass-card rounded-2xl border border-white/5">
          <Film size={32} className="text-neutral-600 mb-2" />
          <p className="text-xs font-semibold text-neutral-400">No videos in catalog yet.</p>
          <p className="text-[11px] text-neutral-500 mt-1">Trigger a run to curate your first batch of videos!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 overflow-y-auto pr-1">
          {videos.map((video, idx) => {
            const isSelected = selectedVideoId === video.id;
            return (
              <div
                key={video.id}
                onClick={() => onSelectVideo(video)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start space-x-3 group ${
                  isSelected
                    ? 'bg-rose-500/10 border-rose-500/40 shadow-lg shadow-rose-500/5'
                    : 'bg-neutral-900/60 border-neutral-800/80 hover:bg-neutral-800/60 hover:border-neutral-700'
                }`}
              >
                {/* Thumbnail / Video Icon */}
                <div className="relative w-14 h-18 rounded-lg bg-neutral-950 flex-shrink-0 overflow-hidden border border-neutral-800 flex items-center justify-center">
                  <Film size={18} className="text-neutral-600 group-hover:text-rose-400 transition" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <Play size={16} className="fill-white text-white" />
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-neutral-500">#{idx + 1}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-semibold">
                      <CheckCircle2 size={10} />
                      Curated
                    </span>
                  </div>

                  <p className="text-xs font-medium text-neutral-200 line-clamp-2 leading-snug group-hover:text-white transition">
                    {video.title}
                  </p>

                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400">
                    <span className="truncate max-w-[120px]">@{video.channel}</span>
                    <span>❤️ {video.likes}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
