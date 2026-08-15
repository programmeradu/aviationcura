import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { VideoPlayer } from './components/VideoPlayer';
import type { VideoData } from './components/VideoPlayer';
import { CommandCenter } from './components/CommandCenter';
import { VideoHistoryDrawer } from './components/VideoHistoryDrawer';
import { Smartphone, Sliders, Database, ChevronLeft, ChevronRight } from 'lucide-react';

const FALLBACK_VIDEOS: VideoData[] = [
  {
    id: 'nDjEB58JswQ',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    title: "Someone captured this insane drone stunt with a 3-second hover time! Mind blown! 🚀 What's your favorite drone trick? #DroneStunt #TechGadgets",
    channel: '808Tech Daily',
    likes: '24.8K',
    comments: '482',
    shares: '1.2K'
  },
  {
    id: '87yEhExKQ2Q',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    title: "Someone unboxed the brand new Space Black iPhone Air in a mesmerizing ASMR experience! 📱 Unwind and relax with me? #iPhoneAir #ASMR #TechUnboxing",
    channel: 'Gio San Pedro',
    likes: '19.4K',
    comments: '319',
    shares: '840'
  },
  {
    id: 'Mhqz8Hf9wrk',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    title: "Someone captured a person being convinced to give up $100 cash in under 2 minutes 🤑 Watch this mind-bending manipulation technique in action.",
    channel: 'Darkful Mind',
    likes: '35.1K',
    comments: '890',
    shares: '4.5K'
  }
];

export function App() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [activeNiche, setActiveNiche] = useState('tech_gadgets');
  const [captionText, setCaptionText] = useState('');
  const [mobileTab, setMobileTab] = useState<'preview' | 'controls' | 'history'>('preview');

  // Fetch real videos from Cloudflare Worker D1 API
  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/videos');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: VideoData[] = data.map((item: any) => ({
            id: item.videoId,
            url: `/api/video/${item.videoId}`,
            title: item.humanized_caption || item.title,
            channel: item.keyword_used || 'curator_network',
            likes: (Math.floor(Math.random() * 40) + 10) + '.' + Math.floor(Math.random() * 9) + 'K',
            comments: Math.floor(Math.random() * 600) + 50,
            shares: Math.floor(Math.random() * 300) + 20
          }));
          setVideos(mapped);
          setCaptionText(mapped[0]?.title || '');
          return;
        }
      }
      throw new Error('Using fallback sample data');
    } catch (e) {
      console.log('Using sample fallback dataset for preview:', e);
      setVideos(FALLBACK_VIDEOS);
      setCaptionText(FALLBACK_VIDEOS[0].title);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleTriggerRun = async () => {
    setIsTriggering(true);
    try {
      const res = await fetch('/api/trigger', { method: 'POST' });
      if (res.ok) {
        console.log('Workflow triggered successfully');
        // Refresh videos list after 8 seconds
        setTimeout(() => {
          fetchVideos();
          setIsTriggering(false);
        }, 8000);
      } else {
        setIsTriggering(false);
      }
    } catch (err) {
      console.error('Trigger failed:', err);
      setTimeout(() => setIsTriggering(false), 3000);
    }
  };

  const currentVideo = videos[selectedVideoIndex] || videos[0] || null;

  const handleSelectVideo = (video: VideoData) => {
    const idx = videos.findIndex((v) => v.id === video.id);
    if (idx !== -1) {
      setSelectedVideoIndex(idx);
      setCaptionText(video.title);
    }
  };

  const handlePrevVideo = () => {
    if (selectedVideoIndex > 0) {
      const newIdx = selectedVideoIndex - 1;
      setSelectedVideoIndex(newIdx);
      setCaptionText(videos[newIdx].title);
    }
  };

  const handleNextVideo = () => {
    if (selectedVideoIndex < videos.length - 1) {
      const newIdx = selectedVideoIndex + 1;
      setSelectedVideoIndex(newIdx);
      setCaptionText(videos[newIdx].title);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-neutral-950 flex flex-col items-center justify-center space-y-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-rose-500/20"></div>
          <div className="absolute inset-0 rounded-full border-2 border-rose-500 border-t-transparent animate-spin"></div>
        </div>
        <p className="text-xs font-mono text-neutral-400">Loading Curator Studio...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col antialiased">
      {/* Top Bar */}
      <Header
        onTriggerRun={handleTriggerRun}
        isTriggering={isTriggering}
        totalCurated={videos.length}
        activeNiche={activeNiche}
      />

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden flex items-center justify-around bg-neutral-900 border-b border-neutral-800 px-2 py-2">
        <button
          onClick={() => setMobileTab('preview')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
            mobileTab === 'preview' ? 'bg-rose-500 text-white' : 'text-neutral-400'
          }`}
        >
          <Smartphone size={14} />
          <span>Preview</span>
        </button>
        <button
          onClick={() => setMobileTab('controls')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
            mobileTab === 'controls' ? 'bg-rose-500 text-white' : 'text-neutral-400'
          }`}
        >
          <Sliders size={14} />
          <span>Studio Controls</span>
        </button>
        <button
          onClick={() => setMobileTab('history')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
            mobileTab === 'history' ? 'bg-rose-500 text-white' : 'text-neutral-400'
          }`}
        >
          <Database size={14} />
          <span>Catalog ({videos.length})</span>
        </button>
      </div>

      {/* Main Studio Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Phone Preview */}
        <div
          className={`lg:col-span-5 flex flex-col items-center justify-center ${
            mobileTab === 'preview' ? 'block' : 'hidden lg:flex'
          }`}
        >
          {/* Phone Mockup Frame */}
          <div className="relative w-full max-w-[340px] sm:max-w-[360px] aspect-[9/16] max-h-[82vh] bg-black rounded-[38px] p-2.5 shadow-2xl border-[5px] border-neutral-800 ring-1 ring-white/10 flex flex-col overflow-hidden">
            {/* Phone Notch/Island */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-neutral-900 rounded-full z-40 flex items-center justify-end pr-2">
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-800 border border-neutral-700"></div>
            </div>

            {/* Internal Screen Area */}
            <div className="relative flex-1 w-full h-full rounded-[28px] overflow-hidden bg-neutral-950">
              {currentVideo ? (
                <VideoPlayer video={currentVideo} isActive={true} />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-neutral-500">
                  No video selected
                </div>
              )}
            </div>
          </div>

          {/* Quick Video Switcher Controls under Phone */}
          <div className="mt-3.5 flex items-center space-x-3 text-xs">
            <button
              onClick={handlePrevVideo}
              disabled={selectedVideoIndex === 0}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 disabled:opacity-30 text-neutral-300 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <span className="text-neutral-500 font-mono">
              {selectedVideoIndex + 1} / {videos.length}
            </span>
            <button
              onClick={handleNextVideo}
              disabled={selectedVideoIndex === videos.length - 1}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 disabled:opacity-30 text-neutral-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Right Column: Command Center & Catalog Tabs */}
        <div
          className={`lg:col-span-7 flex flex-col space-y-6 ${
            mobileTab === 'controls' || mobileTab === 'history' ? 'block' : 'hidden lg:flex'
          }`}
        >
          {mobileTab === 'history' ? (
            <div className="glass-panel rounded-3xl border border-white/10 shadow-2xl">
              <VideoHistoryDrawer
                videos={videos}
                selectedVideoId={currentVideo?.id || null}
                onSelectVideo={handleSelectVideo}
              />
            </div>
          ) : (
            <>
              {/* Command Center */}
              <div className="glass-panel rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                <CommandCenter
                  currentVideo={currentVideo}
                  activeNiche={activeNiche}
                  onSelectNiche={setActiveNiche}
                  isTriggering={isTriggering}
                  captionText={captionText}
                  onChangeCaption={setCaptionText}
                />
              </div>

              {/* Curated Catalog Section below Command Center on Desktop */}
              <div className="hidden lg:block glass-panel rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                <VideoHistoryDrawer
                  videos={videos}
                  selectedVideoId={currentVideo?.id || null}
                  onSelectVideo={handleSelectVideo}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
