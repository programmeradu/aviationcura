import React, { useRef, useEffect, useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Music, Signal, Wifi, BatteryFull } from 'lucide-react';

export interface VideoData {
  id: string;
  url: string;
  title: string;
  channel: string;
  likes: string;
  comments: string;
  shares: string;
}

interface VideoPlayerProps {
  video: VideoData;
  isActive: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.play().catch(e => console.log("Autoplay blocked:", e));
      setIsPlaying(true);
    } else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive]);

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

  return (
    <div className="relative w-full h-full snap-start bg-black flex justify-center items-center overflow-hidden">
      {/* Fake Status Bar */}
      <header className="absolute top-0 left-0 right-0 flex justify-between items-center p-4 z-20 text-sm font-semibold opacity-75">
        <div className="flex items-center space-x-1">
          <Signal size={14} />
          <Wifi size={14} />
        </div>
        <div className="flex items-center">
          <BatteryFull size={16} />
        </div>
      </header>

      {/* Video Element */}
      <video
        ref={videoRef}
        src={video.url}
        className="w-full h-full object-cover cursor-pointer"
        onClick={togglePlay}
        loop
        playsInline
      />

      {/* Gradient Overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10" />

      {/* Content Area */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col p-4 pb-8 z-20 pointer-events-none">
        
        {/* Right Side Action Buttons */}
        <div className="absolute right-4 bottom-20 flex flex-col items-center space-y-6 pointer-events-auto">
          <button className="flex flex-col items-center group focus:outline-none">
            <div className="icon-button w-12 h-12 rounded-full flex items-center justify-center mb-1 text-white hover:bg-white/30 transition">
              <Heart size={28} className="group-active:scale-90 transition-transform" />
            </div>
            <span className="text-xs font-semibold text-shadow text-white">{video.likes}</span>
          </button>

          <button className="flex flex-col items-center group focus:outline-none">
            <div className="icon-button w-12 h-12 rounded-full flex items-center justify-center mb-1 text-white hover:bg-white/30 transition">
              <MessageCircle size={28} className="group-active:scale-90 transition-transform" />
            </div>
            <span className="text-xs font-semibold text-shadow text-white">{video.comments}</span>
          </button>

          <button className="flex flex-col items-center group focus:outline-none">
            <div className="icon-button w-12 h-12 rounded-full flex items-center justify-center mb-1 text-white hover:bg-white/30 transition">
              <Bookmark size={28} className="group-active:scale-90 transition-transform" />
            </div>
            <span className="text-xs font-semibold text-shadow text-white">Save</span>
          </button>

          <button className="flex flex-col items-center group focus:outline-none">
            <div className="icon-button w-12 h-12 rounded-full flex items-center justify-center mb-1 text-white hover:bg-white/30 transition">
              <Share2 size={28} className="group-active:scale-90 transition-transform" />
            </div>
            <span className="text-xs font-semibold text-shadow text-white">{video.shares}</span>
          </button>
        </div>

        {/* Left Side Info */}
        <div className="w-4/5 pr-16 text-white pointer-events-auto">
          <div className="flex items-center mb-2">
            <span className="font-bold text-base text-shadow">@{video.channel}</span>
            <span className="text-sm text-gray-300 ml-2 font-medium text-shadow">· Just now</span>
          </div>
          
          <p className="text-sm mb-3 leading-snug text-shadow pr-4">
            {video.title}
          </p>
          
          <div className="flex items-center text-sm font-medium text-shadow bg-black/20 rounded-full px-3 py-1 w-max">
            <Music size={14} className="mr-2" />
            <span className="truncate max-w-[200px]">Original Sound - @{video.channel}</span>
          </div>
        </div>
      </div>

    </div>
  );
};
