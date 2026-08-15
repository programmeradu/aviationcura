import React, { useRef, useEffect, useState } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Music,
  Play,
  Volume2,
  VolumeX,
  AlertCircle
} from 'lucide-react';

export interface VideoData {
  id: string;
  url: string;
  title: string;
  channel: string;
  likes: string;
  comments: string | number;
  shares: string | number;
}

interface VideoPlayerProps {
  video: VideoData;
  isActive: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(14200);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    if (isActive && videoRef.current) {
      videoRef.current.play().catch((e) => {
        console.log("Autoplay blocked:", e);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    } else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive, video.url]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!liked) {
      setLiked(true);
      setLikeCount((prev) => prev + 1);
    } else {
      setLiked(false);
      setLikeCount((prev) => prev - 1);
    }
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaved(!saved);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const total = videoRef.current.duration || 1;
    setProgress((current / total) * 100);
  };

  return (
    <div className="relative w-full h-full bg-black flex justify-center items-center overflow-hidden select-none">
      {/* Video Stream */}
      <video
        ref={videoRef}
        src={video.url}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onError={() => setHasError(true)}
        loop
        playsInline
        muted={isMuted}
      />

      {/* Video Stream Error Overlay */}
      {hasError && (
        <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center z-10">
          <AlertCircle size={28} className="text-neutral-500 mb-2" />
          <p className="text-xs font-semibold text-neutral-300 font-mono">Stream Synchronizing</p>
          <p className="text-[11px] text-neutral-500 mt-1 max-w-[220px]">
            Video is currently processing in Cloudflare R2.
          </p>
        </div>
      )}

      {/* Play/Pause Minimal Overlay Indicator */}
      {!isPlaying && !hasError && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 cursor-pointer"
        >
          <div className="w-14 h-14 rounded-full bg-black/70 flex items-center justify-center border border-white/20">
            <Play size={22} className="fill-white text-white translate-x-0.5" />
          </div>
        </div>
      )}

      {/* Top Header Overlay: Clean Minimal Badges */}
      <div className="absolute top-0 left-0 right-0 p-3.5 flex items-center justify-between z-30 pointer-events-none">
        <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-black/60 border border-white/10 text-[10px] font-mono text-neutral-300 pointer-events-auto">
          <span>9:16 CURATION</span>
        </div>

        <button
          onClick={toggleMute}
          className="w-7 h-7 rounded bg-black/60 border border-white/10 flex items-center justify-center text-neutral-300 pointer-events-auto hover:text-white transition cursor-pointer"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>
      </div>

      {/* Bottom Gradient Overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none z-10" />

      {/* Right Action Sidebar (Monochrome TikTok Style) */}
      <div className="absolute right-2.5 bottom-12 flex flex-col items-center space-y-3.5 z-20 pointer-events-auto">
        {/* Minimal Avatar */}
        <div className="relative mb-1">
          <div className="w-8 h-8 rounded-full border border-white bg-neutral-900 flex items-center justify-center text-white font-bold text-[10px] font-mono">
            CR
          </div>
        </div>

        {/* Like Button */}
        <button onClick={handleLike} className="flex flex-col items-center group cursor-pointer focus:outline-none">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center mb-0.5 transition-all ${
              liked
                ? 'bg-white text-black'
                : 'bg-black/60 text-white hover:bg-neutral-900 border border-white/15'
            }`}
          >
            <Heart size={16} className={liked ? 'fill-black' : ''} />
          </div>
          <span className="text-[10px] font-mono text-white text-shadow-clean">
            {liked ? (likeCount / 1000).toFixed(1) + 'K' : video.likes}
          </span>
        </button>

        {/* Comment Button */}
        <button className="flex flex-col items-center group cursor-pointer focus:outline-none">
          <div className="w-9 h-9 rounded-full bg-black/60 text-white hover:bg-neutral-900 border border-white/15 flex items-center justify-center mb-0.5 transition">
            <MessageCircle size={16} />
          </div>
          <span className="text-[10px] font-mono text-white text-shadow-clean">{video.comments}</span>
        </button>

        {/* Bookmark / Save Button */}
        <button onClick={handleSave} className="flex flex-col items-center group cursor-pointer focus:outline-none">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center mb-0.5 transition ${
              saved
                ? 'bg-white text-black'
                : 'bg-black/60 text-white hover:bg-neutral-900 border border-white/15'
            }`}
          >
            <Bookmark size={16} className={saved ? 'fill-black' : ''} />
          </div>
          <span className="text-[10px] font-mono text-white text-shadow-clean">
            {saved ? 'Saved' : 'Save'}
          </span>
        </button>

        {/* Share Button */}
        <button className="flex flex-col items-center group cursor-pointer focus:outline-none">
          <div className="w-9 h-9 rounded-full bg-black/60 text-white hover:bg-neutral-900 border border-white/15 flex items-center justify-center mb-0.5 transition">
            <Share2 size={16} />
          </div>
          <span className="text-[10px] font-mono text-white text-shadow-clean">{video.shares}</span>
        </button>
      </div>

      {/* Left Bottom Video Info & Caption */}
      <div className="absolute bottom-3 left-0 right-14 p-3.5 z-20 pointer-events-none">
        <div className="flex items-center space-x-1.5 mb-1 pointer-events-auto">
          <span className="font-semibold text-xs text-white text-shadow-clean tracking-tight font-mono">
            @{video.channel}
          </span>
        </div>

        {/* Humanized Hook Caption */}
        <p className="text-[11px] text-neutral-200 leading-snug text-shadow-clean line-clamp-3 mb-2 pointer-events-auto font-sans">
          {video.title}
        </p>

        {/* Sound Bar */}
        <div className="flex items-center text-[10px] font-mono text-neutral-300 bg-black/60 rounded px-2 py-0.5 w-max border border-white/10 pointer-events-auto">
          <Music size={10} className="mr-1 text-white" />
          <span className="truncate max-w-[140px]">Original Audio · @{video.channel}</span>
        </div>
      </div>

      {/* Video Progress Scrubber Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-800 z-30">
        <div
          className="h-full bg-white transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
