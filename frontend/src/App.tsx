import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock3,
  Eye,
  PanelLeft,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { Header } from './components/Header';
import { VideoPlayer } from './components/VideoPlayer';
import type { VideoData } from './components/VideoPlayer';
import { CommandCenter } from './components/CommandCenter';
import { VideoHistoryDrawer } from './components/VideoHistoryDrawer';

const FALLBACK_VIDEOS: VideoData[] = [
  {
    id: 'nDjEB58JswQ',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    title: 'A close look at one of the most precise low-altitude drone manoeuvres captured this week.',
    channel: '808Tech Daily',
    likes: '24.8K',
    comments: '482',
    shares: '1.2K',
  },
  {
    id: '87yEhExKQ2Q',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    title: 'The passenger experience inside a contemporary wide-body cabin, from boarding to descent.',
    channel: 'Gio San Pedro',
    likes: '19.4K',
    comments: '319',
    shares: '840',
  },
  {
    id: 'Mhqz8Hf9wrk',
    url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    title: 'Why a crosswind approach is one of the most demanding moments in commercial flight.',
    channel: 'Darkful Mind',
    likes: '35.1K',
    comments: '890',
    shares: '4.5K',
  },
];

type MobilePanel = 'library' | 'preview' | 'release';

export function App() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [activeNiche, setActiveNiche] = useState('aviation');
  const [captionText, setCaptionText] = useState('');
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('preview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activePlaylist, setActivePlaylist] = useState<VideoData[]>([]);
  const [activePlaylistIndex, setActivePlaylistIndex] = useState(0);

  const fetchVideos = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/videos?t=${Date.now()}`);
      if (!response.ok) throw new Error('Video archive unavailable');
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('No stored exports');

      const mapped: VideoData[] = data.map((item: any) => ({
        id: item.videoId,
        url: `/api/video/${item.videoId}`,
        title: item.humanized_caption || item.title,
        channel: item.keyword_used || 'aviationcura',
        likes: item.likes || '—',
        comments: item.comments || '—',
        shares: item.shares || '—',
      }));
      setVideos(mapped);
      setCaptionText((previous) => previous || mapped[0]?.title || '');
    } catch (error) {
      console.info('Displaying sample production assets:', error);
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

  useEffect(() => {
    if (videos.length > 0 && activePlaylist.length === 0) {
      setActivePlaylist(videos);
      setActivePlaylistIndex(0);
    }
  }, [videos, activePlaylist.length]);

  const handleTriggerRun = async () => {
    setIsTriggering(true);
    try {
      const response = await fetch('/api/trigger', { method: 'POST' });
      if (!response.ok) throw new Error('Pipeline trigger rejected');
      const data = (await response.json()) as { id?: string };

      if (!data.id) {
        window.setTimeout(async () => {
          await fetchVideos();
          setIsTriggering(false);
        }, 15000);
        return;
      }

      let attempts = 0;
      const poll = window.setInterval(async () => {
        attempts += 1;
        try {
          const statusResponse = await fetch(`/api/workflow-status/${data.id}?t=${Date.now()}`);
          if (!statusResponse.ok) return;
          const status = await statusResponse.json() as { status?: string };
          const complete = ['complete', 'errored', 'terminated'].includes(status.status || '');
          if (complete || attempts > 120) {
            window.clearInterval(poll);
            await fetchVideos();
            setSelectedVideoIndex(0);
            setIsTriggering(false);
          }
        } catch (pollError) {
          console.warn('Workflow status unavailable:', pollError);
        }
      }, 3000);
    } catch (error) {
      console.error('Pipeline trigger failed:', error);
      window.setTimeout(() => setIsTriggering(false), 2000);
    }
  };

  const currentVideo = activePlaylist[activePlaylistIndex] || videos[selectedVideoIndex] || videos[0] || null;

  const updateCaptionForVideo = async (video: VideoData) => {
    setCaptionText(video.title);
    try {
      const response = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: video.title,
          author: video.channel !== 'aviationcura' ? video.channel : '',
          niche: activeNiche,
        }),
      });
      if (!response.ok) return;
      const data = await response.json() as { success?: boolean; caption?: string };
      if (data.success && data.caption) setCaptionText(data.caption);
    } catch (error) {
      console.warn('Caption assistant unavailable:', error);
    }
  };

  const handleSelectVideo = async (video: VideoData, customList?: VideoData[]) => {
    const list = customList || (activePlaylist.length ? activePlaylist : videos);
    const index = list.findIndex((item) => item.id === video.id);

    if (customList) {
      setActivePlaylist(customList);
      setActivePlaylistIndex(Math.max(index, 0));
    } else if (index >= 0) {
      setActivePlaylistIndex(index);
    } else {
      setActivePlaylist([video, ...activePlaylist]);
      setActivePlaylistIndex(0);
    }

    setMobilePanel('preview');
    await updateCaptionForVideo(video);
  };

  const navigateVideo = (direction: -1 | 1) => {
    const list = activePlaylist.length ? activePlaylist : videos;
    const currentIndex = activePlaylist.length ? activePlaylistIndex : selectedVideoIndex;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= list.length) return;

    if (activePlaylist.length) setActivePlaylistIndex(nextIndex);
    else setSelectedVideoIndex(nextIndex);
    void updateCaptionForVideo(list[nextIndex]);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-mark"><Sparkles size={22} /></div>
        <p>Preparing your flight deck</p>
      </div>
    );
  }

  const playlistLength = activePlaylist.length || videos.length;
  const playlistIndex = activePlaylist.length ? activePlaylistIndex : selectedVideoIndex;

  return (
    <div className="studio-app">
      <Header
        onTriggerRun={handleTriggerRun}
        isTriggering={isTriggering}
        totalCurated={videos.length}
        activeNiche={activeNiche}
      />

      <nav className="mobile-studio-nav" aria-label="Studio panels">
        <button className={mobilePanel === 'library' ? 'is-active' : ''} onClick={() => setMobilePanel('library')}>
          <PanelLeft size={16} /> Library
        </button>
        <button className={mobilePanel === 'preview' ? 'is-active' : ''} onClick={() => setMobilePanel('preview')}>
          <Eye size={16} /> Preview
        </button>
        <button className={mobilePanel === 'release' ? 'is-active' : ''} onClick={() => setMobilePanel('release')}>
          <SlidersHorizontal size={16} /> Release
        </button>
      </nav>

      <main className="studio-grid">
        <aside className={`studio-panel library-panel ${mobilePanel === 'library' ? 'mobile-visible' : ''}`}>
          <VideoHistoryDrawer
            videos={videos}
            selectedVideoId={currentVideo?.id || null}
            onSelectVideo={handleSelectVideo}
            onRefresh={fetchVideos}
            isRefreshing={isRefreshing}
          />
        </aside>

        <section className={`preview-workspace ${mobilePanel === 'preview' ? 'mobile-visible' : ''}`}>
          <div className="workspace-heading">
            <div>
              <span className="eyebrow"><Clapperboard size={14} /> Release preview</span>
              <h2>Ready for review</h2>
              <p>Inspect the final vertical composition before distribution.</p>
            </div>
            <div className="preview-meta">
              <span>9:16</span>
              <span className="status-dot">Original export</span>
            </div>
          </div>

          <div className="preview-stage">
            <div className="stage-orbit stage-orbit-one" />
            <div className="stage-orbit stage-orbit-two" />
            <div className="phone-frame" aria-label="Vertical video preview">
              <div className="phone-speaker" />
              <div className="phone-screen">
                {currentVideo ? <VideoPlayer video={currentVideo} isActive /> : <div className="empty-preview">Select an asset to begin.</div>}
              </div>
            </div>
          </div>

          <div className="preview-footer">
            <div className="pager-control" aria-label="Asset navigation">
              <button onClick={() => navigateVideo(-1)} disabled={playlistIndex === 0} aria-label="Previous asset"><ChevronLeft size={17} /></button>
              <span><strong>{String(playlistIndex + 1).padStart(2, '0')}</strong> / {String(playlistLength).padStart(2, '0')}</span>
              <button onClick={() => navigateVideo(1)} disabled={playlistIndex >= playlistLength - 1} aria-label="Next asset"><ChevronRight size={17} /></button>
            </div>
            <div className="preview-health">
              <Clock3 size={15} />
              <span>Render status</span>
              <strong>{isTriggering ? 'Pipeline running' : 'Ready to publish'}</strong>
            </div>
          </div>
        </section>

        <aside className={`studio-panel controls-panel ${mobilePanel === 'release' ? 'mobile-visible' : ''}`}>
          <CommandCenter
            currentVideo={currentVideo}
            activeNiche={activeNiche}
            onSelectNiche={setActiveNiche}
            isTriggering={isTriggering}
            captionText={captionText}
            onChangeCaption={setCaptionText}
            onVideoGenerated={fetchVideos}
          />
        </aside>
      </main>
    </div>
  );
}

export default App;
