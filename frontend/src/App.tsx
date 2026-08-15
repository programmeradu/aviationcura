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
  const [activeNiche, setActiveNiche] = useState('cyprus_tourism');
  const [captionText, setCaptionText] = useState('');
  const [mobileTab, setMobileTab] = useState<'preview' | 'controls' | 'history'>('preview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch real videos from Cloudflare Worker D1 API
  const fetchVideos = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/videos?t=${Date.now()}`);
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
          setCaptionText((prev) => prev || mapped[0]?.title || '');
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
      setIsRefreshing(false);
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
        const data = await res.json() as any;
        console.log('Workflow triggered:', data);
        const instanceId = data.id;

        if (instanceId) {
          let attempts = 0;
          const interval = setInterval(async () => {
            attempts++;
            try {
              const statusRes = await fetch(`/api/workflow-status/${instanceId}?t=${Date.now()}`);
              if (statusRes.ok) {
                const statusData = await statusRes.json() as any;
                console.log('Workflow status poll:', statusData);
                if (statusData.status === 'complete' || statusData.status === 'errored' || statusData.status === 'terminated' || attempts > 120) {
                  clearInterval(interval);
                  await fetchVideos();
                  setSelectedVideoIndex(0);
                  setIsTriggering(false);
                }
              }
            } catch (pollErr) {
              console.error('Polling error:', pollErr);
            }
          }, 3000);
        } else {
          setTimeout(async () => {
            await fetchVideos();
            setIsTriggering(false);
          }, 15000);
        }
      } else {
        setIsTriggering(false);
      }
    } catch (err) {
      console.error('Trigger failed:', err);
      setTimeout(() => setIsTriggering(false), 3000);
    }
  };

  const [customVideo, setCustomVideo] = useState<VideoData | null>(null);

  const currentVideo = customVideo || videos[selectedVideoIndex] || videos[0] || null;

  const handleSelectVideo = (video: VideoData) => {
    setCustomVideo(video);
    setCaptionText(video.title);
    // Switch to preview tab on mobile when clicking a video
    setMobileTab('preview');
  };

  const handlePrevVideo = () => {
    setCustomVideo(null);
    if (selectedVideoIndex > 0) {
      const newIdx = selectedVideoIndex - 1;
      setSelectedVideoIndex(newIdx);
      setCaptionText(videos[newIdx].title);
    }
  };

  const handleNextVideo = () => {
    setCustomVideo(null);
    if (selectedVideoIndex < videos.length - 1) {
      const newIdx = selectedVideoIndex + 1;
      setSelectedVideoIndex(newIdx);
      setCaptionText(videos[newIdx].title);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center space-y-3">
        <div className="w-6 h-6 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
        <p className="text-xs font-mono text-neutral-500">INITIALIZING STUDIO</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col antialiased font-sans">
      {/* Top Bar */}
      <Header
        onTriggerRun={handleTriggerRun}
        isTriggering={isTriggering}
        totalCurated={videos.length}
        activeNiche={activeNiche}
      />

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden flex items-center justify-around bg-[#0a0a0a] border-b border-[#222222] px-2 py-2">
        <button
          onClick={() => setMobileTab('preview')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium cursor-pointer ${
            mobileTab === 'preview' ? 'bg-white text-black font-semibold' : 'text-neutral-400'
          }`}
        >
          <Smartphone size={13} />
          <span>Preview</span>
        </button>
        <button
          onClick={() => setMobileTab('controls')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium cursor-pointer ${
            mobileTab === 'controls' ? 'bg-white text-black font-semibold' : 'text-neutral-400'
          }`}
        >
          <Sliders size={13} />
          <span>Controls</span>
        </button>
        <button
          onClick={() => setMobileTab('history')}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium cursor-pointer ${
            mobileTab === 'history' ? 'bg-white text-black font-semibold' : 'text-neutral-400'
          }`}
        >
          <Database size={13} />
          <span>Archive ({videos.length})</span>
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
          <div className="relative w-full max-w-[340px] sm:max-w-[360px] aspect-[9/16] max-h-[82vh] bg-black rounded-[32px] p-2 border border-[#27272a] shadow-2xl flex flex-col overflow-hidden">
            {/* Phone Top Notch Bar */}
            <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-20 h-3.5 bg-[#121212] rounded-full z-40 flex items-center justify-end pr-2">
              <div className="w-2 h-2 rounded-full bg-[#202020]"></div>
            </div>

            {/* Internal Screen Area */}
            <div className="relative flex-1 w-full h-full rounded-[24px] overflow-hidden bg-[#050505]">
              {currentVideo ? (
                <VideoPlayer video={currentVideo} isActive={true} />
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-neutral-500 font-mono">
                  NO VIDEO SELECTED
                </div>
              )}
            </div>
          </div>

          {/* Video Switcher Controls */}
          <div className="mt-3.5 flex items-center space-x-2.5 text-xs font-mono">
            <button
              onClick={handlePrevVideo}
              disabled={selectedVideoIndex === 0}
              className="px-3 py-1.5 rounded bg-[#111111] border border-[#222222] hover:bg-[#1a1a1a] hover:border-[#333333] disabled:opacity-30 text-neutral-300 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft size={13} />
              <span>PREV</span>
            </button>
            <span className="text-neutral-500 px-2">
              {selectedVideoIndex + 1} / {videos.length}
            </span>
            <button
              onClick={handleNextVideo}
              disabled={selectedVideoIndex === videos.length - 1}
              className="px-3 py-1.5 rounded bg-[#111111] border border-[#222222] hover:bg-[#1a1a1a] hover:border-[#333333] disabled:opacity-30 text-neutral-300 flex items-center gap-1 cursor-pointer"
            >
              <span>NEXT</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Right Column: Command Center & Archive */}
        <div
          className={`lg:col-span-7 flex flex-col space-y-5 ${
            mobileTab === 'controls' || mobileTab === 'history' ? 'block' : 'hidden lg:flex'
          }`}
        >
          {mobileTab === 'history' ? (
            <div className="flat-panel rounded-2xl overflow-hidden">
              <VideoHistoryDrawer
                videos={videos}
                selectedVideoId={currentVideo?.id || null}
                onSelectVideo={handleSelectVideo}
                onRefresh={fetchVideos}
                isRefreshing={isRefreshing}
              />
            </div>
          ) : (
            <>
              {/* Command Center */}
              <div className="flat-panel rounded-2xl overflow-hidden">
                <CommandCenter
                  currentVideo={currentVideo}
                  activeNiche={activeNiche}
                  onSelectNiche={setActiveNiche}
                  isTriggering={isTriggering}
                  captionText={captionText}
                  onChangeCaption={setCaptionText}
                />
              </div>

              {/* Archive Section */}
              <div className="hidden lg:block flat-panel rounded-2xl overflow-hidden">
                <VideoHistoryDrawer
                  videos={videos}
                  selectedVideoId={currentVideo?.id || null}
                  onSelectVideo={handleSelectVideo}
                  onRefresh={fetchVideos}
                  isRefreshing={isRefreshing}
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
