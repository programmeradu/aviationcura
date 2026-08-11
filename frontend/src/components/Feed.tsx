import React, { useEffect, useRef, useState } from 'react';
import { VideoPlayer } from './VideoPlayer';
import type { VideoData } from './VideoPlayer';

interface FeedProps {
  videos: VideoData[];
}

export const Feed: React.FC<FeedProps> = ({ videos }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            setActiveIndex(index);
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.6, // Fire when 60% of the video is visible
      }
    );

    const elements = document.querySelectorAll('.video-snap-item');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [videos]);

  return (
    <div 
      ref={containerRef}
      className="h-[100dvh] w-full max-w-[500px] mx-auto bg-black overflow-y-scroll snap-y snap-mandatory scrollbar-hide relative"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {videos.length === 0 ? (
        <div className="h-full flex items-center justify-center text-white">
          <p>No videos found.</p>
        </div>
      ) : (
        videos.map((video, index) => (
          <div key={video.id} data-index={index} className="video-snap-item h-[100dvh] w-full snap-start relative">
            <VideoPlayer video={video} isActive={index === activeIndex} />
          </div>
        ))
      )}
    </div>
  );
};
