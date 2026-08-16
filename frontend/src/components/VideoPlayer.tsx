import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Share2,
  Volume2,
  VolumeX,
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
  const [isSaved, setIsSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    setProgress(0);
    const element = videoRef.current;
    if (!element) return;

    if (isActive) {
      element.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      element.pause();
      element.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive, video.url]);

  const togglePlayback = () => {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) {
      void element.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      element.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (event: React.MouseEvent) => {
    event.stopPropagation();
    const element = videoRef.current;
    if (!element) return;
    const nextMuted = !isMuted;
    element.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  return (
    <div className="release-monitor" onClick={togglePlayback}>
      <video
        ref={videoRef}
        src={video.url}
        className="release-video"
        onTimeUpdate={() => {
          const element = videoRef.current;
          if (element) setProgress((element.currentTime / (element.duration || 1)) * 100);
        }}
        onError={() => setHasError(true)}
        loop
        playsInline
        muted={isMuted}
      />

      <div className="monitor-topline">
        <span className="monitor-badge">Preview</span>
        <div className="monitor-actions">
          <button onClick={toggleMute} type="button" aria-label={isMuted ? 'Enable audio' : 'Mute audio'}>
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button onClick={(event) => event.stopPropagation()} type="button" aria-label="More preview options"><MoreHorizontal size={17} /></button>
        </div>
      </div>

      {hasError && (
        <div className="monitor-error">
          <AlertCircle size={28} />
          <strong>Preview is synchronising</strong>
          <span>The rendered source will be available here as soon as processing completes.</span>
        </div>
      )}

      {!isPlaying && !hasError && (
        <div className="monitor-play-state">
          <div><Play size={22} fill="currentColor" /></div>
          <span>Resume preview</span>
        </div>
      )}

      <div className="monitor-gradient" />
      <div className="monitor-details">
        <div className="creator-row"><span className="creator-avatar">AC</span><strong>@{video.channel}</strong></div>
        <p>{video.title}</p>
        <div className="monitor-tags"><span>AVIATION</span><span>CURATED</span></div>
      </div>

      <div className="monitor-side-actions" onClick={(event) => event.stopPropagation()}>
        <button className={liked ? 'reaction active' : 'reaction'} onClick={() => setLiked((value) => !value)} type="button"><Heart size={17} fill={liked ? 'currentColor' : 'none'} /><span>{liked ? 'Saved' : video.likes}</span></button>
        <button className="reaction" type="button"><MessageCircle size={17} /><span>{video.comments}</span></button>
        <button className={isSaved ? 'reaction active' : 'reaction'} onClick={() => setIsSaved((value) => !value)} type="button"><Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} /><span>{isSaved ? 'Held' : 'Save'}</span></button>
        <button className="reaction" type="button"><Share2 size={17} /><span>{video.shares}</span></button>
      </div>

      <div className="monitor-timeline"><span style={{ width: `${progress}%` }} /></div>
      <div className="monitor-play-toggle" aria-hidden="true">{isPlaying ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}</div>
    </div>
  );
};
