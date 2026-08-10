import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { Container, getContainer } from '@cloudflare/containers';

export interface Env {
	MY_WORKFLOW: Workflow;
	DB: D1Database;
	VIDEOS_BUCKET: R2Bucket;
	AI: Ai;
	YOUTUBE_API_KEY: string;
	RAPIDAPI_KEY: string;
	TELEGRAM_BOT_TOKEN: string;
	TELEGRAM_CHAT_ID: string;
	MICROSERVICE_URL?: string;
	OBFUSCATOR: any;
}

export class ObfuscatorContainer extends Container {
    defaultPort = 3000;
}

export class AviationCuratorWorkflow extends WorkflowEntrypoint<Env, any> {
	async run(event: WorkflowEvent<any>, step: WorkflowStep) {
		const keywords = [
			'a380 takeoff',
			'boeing 747 landing',
			'fighter jet sonic boom',
			'cockpit view takeoff',
			'aviation emergency landing',
			'airport ground control',
			'crosswind landing challenge',
			'private jet flyby'
		];
		const keyword = keywords[Math.floor(Math.random() * keywords.length)];

		// Step 1: Search YouTube
		const searchResults = await step.do('search-youtube', async () => {
			if (!this.env.YOUTUBE_API_KEY) throw new Error("Missing YOUTUBE_API_KEY");
			const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=10&key=${this.env.YOUTUBE_API_KEY}`;
			const res = await fetch(url);
			if (!res.ok) throw new Error(`YouTube Search failed: ${res.statusText}`);
			const data = await res.json() as any;
			return data.items.map((item: any) => ({
				videoId: item.id.videoId,
				title: item.snippet.title,
				channelTitle: item.snippet.channelTitle,
				description: item.snippet.description
			}));
		});

		// Step 2: Deduplicate against D1
		const unseenVideos = await step.do('deduplicate', async () => {
			const ids = searchResults.map((v: any) => v.videoId);
			if (ids.length === 0) return [];
			
			const placeholders = ids.map(() => '?').join(',');
			const { results } = await this.env.DB.prepare(
				`SELECT videoId FROM videos WHERE videoId IN (${placeholders})`
			).bind(...ids).all();
			
			const seenIds = new Set(results.map(r => r.videoId));
			return searchResults.filter((v: any) => !seenIds.has(v.videoId));
		});

		if (unseenVideos.length === 0) {
			console.log("No new videos found for keyword:", keyword);
			return; // End workflow
		}

		// Step 3: Fetch statistics & filter hidden gems
		const selectedVideo = await step.do('filter-gems', async () => {
			const ids = unseenVideos.map((v: any) => v.videoId).join(',');
			const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${this.env.YOUTUBE_API_KEY}`;
			const res = await fetch(url);
			if (!res.ok) throw new Error(`YouTube Stats failed: ${res.statusText}`);
			const data = await res.json() as any;
			
			const statsMap = new Map();
			for (const item of data.items) {
				statsMap.set(item.id, item.statistics);
			}

			const gems = [];
			for (const video of unseenVideos) {
				const stats = statsMap.get(video.videoId);
				if (!stats) continue;
				const views = parseInt(stats.viewCount) || 0;
				const likes = parseInt(stats.likeCount) || 0;
				const engagementRate = views > 0 ? (likes / views) : 0;
				
				const isUnderTheRadar = (views > 0 && views <= 500000 && engagementRate >= 0.01);
				const isPureGem = (views > 0 && views <= 50000 && engagementRate >= 0.03);
				
				if (isUnderTheRadar || isPureGem) {
					gems.push(video);
				}
			}

			const candidates = gems.length > 0 ? gems : unseenVideos;
			return candidates[Math.floor(Math.random() * candidates.length)];
		});

		// Step 4: Generate Caption with Workers AI
		const caption = await step.do('generate-caption', async () => {
			const prompt = `Video title: ${selectedVideo.title}\nVideo description: ${selectedVideo.description}\n\nWrite a caption for sharing this aviation video as a curator (not the creator). Follow the hook/value/CTA structure exactly.`;
			
			const systemMessage = `You are a social media curator running an aviation content discovery account. You find incredible aviation videos made by OTHER creators and share them with your audience — you are NEVER the creator, filmer, or owner of the video.

Voice rules:
- Never use "we/our" as if you filmed or produced this. Use curator framing: "found this," "this pilot did X," "watch this," "someone captured this," "this just landed on my feed"
- Never claim ownership. Never say "our video," "we made," "our aircraft"

Structure (always follow this order):
1. HOOK (line 1): A specific, surprising claim or question about what's IN the video. Not a description — a reason to watch.
2. VALUE (line 2, optional): One concrete, specific detail that proves you actually looked at the video — a number, a location, a maneuver. Never generic filler like "the beauty of flight."
3. CTA (final line): A short soft question or implicit invite to engage.

HARD LENGTH LIMIT: The entire caption, including hashtags, must be under 220 characters total. Count as you write. Every sentence must be complete — never trail off, never leave a thought unfinished. If you cannot fit hook + value + CTA in 220 characters, drop the value line and keep only hook + CTA, but never submit a cut-off sentence.

Format rules:
- 2-3 short lines total, not a paragraph
- Max 3 hashtags, placed at the very end, relevant and specific
- 1-2 emojis max
- No corporate/brand-safe tone — write like a person who is genuinely excited to have found this

Before responding, count the characters in your draft. If over 220, shorten it while keeping every sentence complete.`;

			const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
				messages: [
					{ role: 'system', content: systemMessage },
					{ role: 'user', content: prompt }
				]
			});
			
			// Extract just the text from the response object
			return (response as any).response;
		});

		// Step 5: Download Video via RapidAPI & Upload to R2
		const r2Key = await step.do('download-and-store', async () => {
			if (!this.env.RAPIDAPI_KEY) throw new Error("Missing RAPIDAPI_KEY");
			
			const initialUrl = `https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1/download?format=720&id=${selectedVideo.videoId}&audioQuality=128&addInfo=false&allowExtendedDuration=false`;
			const initRes = await fetch(initialUrl, {
				headers: {
					'x-rapidapi-key': this.env.RAPIDAPI_KEY,
					'x-rapidapi-host': 'youtube-mp4-mp3-downloader.p.rapidapi.com'
				}
			});
			if (!initRes.ok) throw new Error(`RapidAPI init failed: ${initRes.statusText}`);
			const initData = await initRes.json() as any;
			const progressId = initData.progressId;
			if (!progressId) throw new Error("No progressId from RapidAPI");

			let downloadUrl = null;
			let attempts = 0;
			while (attempts < 20) {
				await new Promise(r => setTimeout(r, 5000)); 
				
				const checkUrl = `https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1/progress?id=${progressId}`;
				const checkRes = await fetch(checkUrl, {
					headers: {
						'x-rapidapi-key': this.env.RAPIDAPI_KEY,
						'x-rapidapi-host': 'youtube-mp4-mp3-downloader.p.rapidapi.com'
					}
				});
				const checkData = await checkRes.json() as any;
				if (checkData.downloadUrl || checkData.url) {
					downloadUrl = checkData.downloadUrl || checkData.url;
					break;
				}
				attempts++;
			}

			if (!downloadUrl) throw new Error("Timeout waiting for RapidAPI download URL");

			const videoRes = await fetch(downloadUrl, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
				}
			});
			if (!videoRes.ok) throw new Error("Failed to download MP4 from downloadUrl");
			
			let finalBuffer = await videoRes.arrayBuffer();

			// Obfuscate using Cloudflare Containers
			if (this.env.OBFUSCATOR) {
				console.log("Sending video to Obfuscator Container on the Edge...");
				const containerInstance = getContainer(this.env.OBFUSCATOR, "global");
				const obsRes = await containerInstance.fetch("http://container/obfuscate", {
					method: 'POST',
					body: finalBuffer
				});
				if (!obsRes.ok) {
					console.error("Obfuscation failed", await obsRes.text());
					throw new Error(`Obfuscation failed: ${obsRes.statusText}`);
				}
				finalBuffer = await obsRes.arrayBuffer();
				console.log("Video successfully obfuscated natively on Cloudflare!");
			}
			
			const objectKey = `${selectedVideo.videoId}.mp4`;
			await this.env.VIDEOS_BUCKET.put(objectKey, finalBuffer, {
				httpMetadata: { contentType: 'video/mp4' }
			});
			
			return objectKey;
		});

		// Step 6: Save to D1
		await step.do('save-to-d1', async () => {
			await this.env.DB.prepare(
				`INSERT INTO videos (videoId, title, keyword_used, humanized_caption, r2_url, status) VALUES (?, ?, ?, ?, ?, ?)`
			).bind(selectedVideo.videoId, selectedVideo.title, keyword, caption, r2Key, 'published').run();
		});

		// Step 7: Post to Telegram (if configured)
		if (this.env.TELEGRAM_BOT_TOKEN && this.env.TELEGRAM_CHAT_ID) {
			await step.do('post-telegram', async () => {
				const formData = new FormData();
				formData.append('chat_id', this.env.TELEGRAM_CHAT_ID);
				formData.append('caption', caption);
				
				const videoObject = await this.env.VIDEOS_BUCKET.get(r2Key);
				if (!videoObject) throw new Error("Video not found in R2");
				
				const blob = new Blob([await videoObject.arrayBuffer()], { type: 'video/mp4' });
				formData.append('video', blob, `${selectedVideo.videoId}.mp4`);

				const tgUrl = `https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendVideo`;
				const tgRes = await fetch(tgUrl, {
					method: 'POST',
					body: formData
				});

				if (!tgRes.ok) {
					console.error("Telegram upload failed", await tgRes.text());
					throw new Error("Failed to post to Telegram");
				}
			});
		}

		return {
			success: true,
			videoId: selectedVideo.videoId
		};
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/api/trigger' && request.method === 'POST') {
			const instance = await env.MY_WORKFLOW.create();
			return new Response(JSON.stringify({ id: instance.id, status: 'started' }), {
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (url.pathname === '/api/videos') {
			const { results } = await env.DB.prepare(
				`SELECT * FROM videos ORDER BY created_at DESC LIMIT 20`
			).all();
			return new Response(JSON.stringify(results), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}

		if (url.pathname.startsWith('/api/video/')) {
			const videoId = url.pathname.split('/').pop();
			if (!videoId) return new Response('Invalid video ID', { status: 400 });
			const object = await env.VIDEOS_BUCKET.get(`${videoId}.mp4`);
			if (!object) return new Response('Not found', { status: 404 });
			
			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set('etag', object.httpEtag);

			return new Response(object.body, { headers });
		}

		return new Response('Aviation Curator API', { status: 200 });
	}
};
