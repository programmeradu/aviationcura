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
  Zap
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
  onLike?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(14200);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.play().catch((e) => {
        console.log("Autoplay blocked, user interaction required:", e);
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
        className="w-full h-full object-cover cursor-pointer"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        loop
        playsInline
        muted={isMuted}
      />

      {/* Play/Pause Overlay Indicator when paused */}
      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 z-20 cursor-pointer transition-opacity"
        >
          <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl scale-100 hover:scale-105 transition-transform">
            <Play size={28} className="fill-white text-white translate-x-0.5" />
          </div>
        </div>
      )}

      {/* Top Header Overlay: Live Badge & Mute Control */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-30 pointer-events-none">
        <div className="flex items-center space-x-2 pointer-events-auto">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-white">
            <Zap size={12} className="text-amber-400 fill-amber-400" />
            <span>Curator Feed</span>
          </div>
        </div>

        <button
          onClick={toggleMute}
          className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white pointer-events-auto hover:bg-black/70 transition cursor-pointer"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </div>

      {/* Bottom Gradient Overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10" />

      {/* Right Action Sidebar (TikTok Style) */}
      <div className="absolute right-3 bottom-14 flex flex-col items-center space-y-4 z-20 pointer-events-auto">
        {/* Creator Avatar with follow badge */}
        <div className="relative mb-2">
          <div className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white font-bold text-xs shadow-lg">
            AC
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold shadow">
            +
          </div>
        </div>

        {/* Like Button */}
        <button onClick={handleLike} className="flex flex-col items-center group cursor-pointer focus:outline-none">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center mb-0.5 transition-all ${
              liked
                ? 'bg-rose-500 text-white scale-110 shadow-lg shadow-rose-500/40'
                : 'bg-black/40 backdrop-blur-md text-white hover:bg-black/60 active:scale-90 border border-white/10'
            }`}
          >
            <Heart size={20} className={liked ? 'fill-white' : ''} />
          </div>
          <span className="text-[11px] font-semibold text-white text-shadow-subtle">
            {liked ? (likeCount / 1000).toFixed(1) + 'K' : video.likes}
          </span>
        </button>

        {/* Comment Button */}
        <button className="flex flex-col items-center group cursor-pointer focus:outline-none">
          <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 active:scale-90 border border-white/10 flex items-center justify-center mb-0.5 transition-all">
            <MessageCircle size={20} />
          </div>
          <span className="text-[11px] font-semibold text-white text-shadow-subtle">{video.comments}</span>
        </button>

        {/* Bookmark / Save Button */}
        <button onClick={handleSave} className="flex flex-col items-center group cursor-pointer focus:outline-none">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center mb-0.5 transition-all ${
              saved
                ? 'bg-amber-500 text-black scale-110 shadow-lg shadow-amber-500/40'
                : 'bg-black/40 backdrop-blur-md text-white hover:bg-black/60 active:scale-90 border border-white/10'
            }`}
          >
            <Bookmark size={20} className={saved ? 'fill-black' : ''} />
          </div>
          <span className="text-[11px] font-semibold text-white text-shadow-subtle">
            {saved ? 'Saved' : 'Save'}
          </span>
        </button>

        {/* Share Button */}
        <button className="flex flex-col items-center group cursor-pointer focus:outline-none">
          <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 active:scale-90 border border-white/10 flex items-center justify-center mb-0.5 transition-all">
            <Share2 size={20} />
          </div>
          <span className="text-[11px] font-semibold text-white text-shadow-subtle">{video.shares}</span>
        </button>

        {/* Rotating Music Disc */}
        <div className="pt-2">
          <div className="w-9 h-9 rounded-full bg-neutral-900 border-2 border-neutral-700 flex items-center justify-center shadow-lg animate-spin-disc">
            <div className="w-3.5 h-3.5 rounded-full bg-rose-500 border border-white"></div>
          </div>
        </div>
      </div>

      {/* Left Bottom Video Info & Caption */}
      <div className="absolute bottom-3 left-0 right-14 p-4 z-20 pointer-events-none">
        <div className="flex items-center space-x-2 mb-1.5 pointer-events-auto">
          <span className="font-bold text-sm text-white text-shadow-subtle tracking-wide">
            @{video.channel}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/80 text-white font-semibold uppercase">
            Curator
          </span>
        </div>

        {/* Humanized Hook Caption */}
        <p className="text-xs text-neutral-100 font-normal leading-relaxed text-shadow-subtle line-clamp-3 mb-2.5 pointer-events-auto">
          {video.title}
        </p>

        {/* Sound Bar */}
        <div className="flex items-center text-xs font-medium text-white/90 bg-black/40 backdrop-blur-md rounded-full px-2.5 py-1 w-max border border-white/10 pointer-events-auto">
          <Music size={12} className="mr-1.5 text-rose-400" />
          <span className="truncate max-w-[160px] text-[11px]">Original Audio · @{video.channel}</span>
        </div>
      </div>

      {/* Video Progress Scrubber Bar at very bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
        <div
          className="h-full bg-rose-500 transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
