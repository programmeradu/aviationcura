import { useEffect, useState } from 'react';
import { Feed } from './components/Feed';
import { Sidebar } from './components/Sidebar';
import type { VideoData } from './components/VideoPlayer';

function App() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, this would fetch from GET /api/videos
    // For now, we use dummy data to mock the response
    const fetchVideos = async () => {
      try {
        const response = await fetch('/api/videos');
        if (response.ok) {
          const data = await response.json();
          // Transform DB data to VideoData format
          const mappedVideos = data.map((item: any) => ({
            id: item.videoId,
            url: `/api/video/${item.videoId}`,
            title: item.humanized_caption || item.title,
            channel: 'aviation_curator',
            likes: Math.floor(Math.random() * 50) + 'K', // Mocked for now
            comments: Math.floor(Math.random() * 900),
            shares: Math.floor(Math.random() * 500)
          }));
          setVideos(mappedVideos);
        } else {
          throw new Error('Failed to fetch API');
        }
      } catch (error) {
        console.log("Using fallback videos due to API error", error);
        setVideos([
          {
            id: '1',
            url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            title: 'EPIC ADVENTURE: The Peaks of Patagonia. Can\'t believe you hiked that! #travel #adventure #patagonia',
            channel: 'travel_daily',
            likes: '12.5K',
            comments: '1,234',
            shares: '3.4K'
          },
          {
            id: '2',
            url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
            title: 'Insane Joyride through the city! #cars #joyride',
            channel: 'car_enthusiast',
            likes: '8.2K',
            comments: '456',
            shares: '1.2K'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen w-full flex justify-center overflow-hidden">
      <div className="relative w-full max-w-[500px] h-[100dvh] bg-gray-900 border-x border-gray-800">
        <Feed videos={videos} />
        <Sidebar />
      </div>
    </div>
  );
}

export default App;
