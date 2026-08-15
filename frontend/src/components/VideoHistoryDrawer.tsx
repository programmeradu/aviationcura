import React from 'react';
import { Play, Film, Database } from 'lucide-react';
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Database size={14} className="text-neutral-400" />
          <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider font-mono">
            Stored Archive
          </h2>
        </div>
        <span className="text-[11px] text-neutral-500 font-mono">{videos.length} videos</span>
      </div>

      {videos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center flat-card rounded-xl">
          <Film size={24} className="text-neutral-600 mb-2" />
          <p className="text-xs text-neutral-400 font-mono">Archive Empty</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1">
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
                {/* Minimal Thumbnail Icon */}
                <div className="relative w-12 h-14 rounded bg-[#050505] flex-shrink-0 overflow-hidden border border-[#222222] flex items-center justify-center">
                  <Film size={15} className="text-neutral-500 group-hover:text-white transition" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <Play size={13} className="fill-white text-white" />
                  </div>
                </div>

                {/* Details */}
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
      )}
    </div>
  );
};
