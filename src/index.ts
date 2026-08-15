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
	REPLICATE_API_TOKEN?: string;
	AYRSHARE_API_KEY?: string;
}

export class ObfuscatorContainer extends Container {
    defaultPort = 3000;
}

export class AviationCuratorWorkflow extends WorkflowEntrypoint<Env, any> {
	async run(event: WorkflowEvent<any>, step: WorkflowStep) {
		// Dynamic TikTok Niche Discovery Array (Algorithms love these)
		const trendingNiches = [
			{ niche: 'aviation', queries: ['a380 takeoff', 'boeing 747 landing', 'fighter jet sonic boom', 'cockpit view takeoff'] },
			{ niche: 'oddly_satisfying', queries: ['kinetic sand cutting', 'soap carving ASMR', 'power washing porn', 'satisfying factory machines'] },
			{ niche: 'tech_gadgets', queries: ['coolest amazon finds tech', 'smartphone unboxing ASMR', 'crazy japanese gadgets', 'tech you need under $50'] },
			{ niche: 'dark_psychology', queries: ['body language secrets', 'dark psychology tricks', 'how to read people', 'manipulation techniques to watch out for'] },
			{ niche: 'luxury_lifestyle', queries: ['monaco billionaire lifestyle', 'superyacht tour', 'dubai luxury cars', 'billionaire penthouses'] }
		];
		const selectedCategory = trendingNiches[Math.floor(Math.random() * trendingNiches.length)];
		const keyword = selectedCategory.queries[Math.floor(Math.random() * selectedCategory.queries.length)];
		const activeNiche = selectedCategory.niche;

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
			
			const systemMessage = `You are a social media curator running a viral content discovery account focused on the '${activeNiche}' niche. You find incredible videos made by OTHER creators and share them with your audience — you are NEVER the creator, filmer, or owner of the video.

Voice rules:
- Never use "we/our" as if you filmed or produced this. Use curator framing: "found this," "watch this," "someone captured this," "this just landed on my feed"
- Never claim ownership. Never say "our video," "we made," "our product"

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
			
			const initialUrl = `https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1/download?format=4k&id=${selectedVideo.videoId}&audioQuality=128&addInfo=false&allowExtendedDuration=false`;
			let initRes = await fetch(initialUrl, {
				headers: {
					'x-rapidapi-key': this.env.RAPIDAPI_KEY,
					'x-rapidapi-host': 'youtube-mp4-mp3-downloader.p.rapidapi.com'
				}
			});
			
			// Fallback to 1080p if 4K is not available (which throws Bad Request)
			if (!initRes.ok && initRes.status === 400) {
				console.log("4K format not available, falling back to 1080p...");
				const fallbackUrl = `https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1/download?format=1080&id=${selectedVideo.videoId}&audioQuality=128&addInfo=false&allowExtendedDuration=false`;
				initRes = await fetch(fallbackUrl, {
					headers: {
						'x-rapidapi-key': this.env.RAPIDAPI_KEY,
						'x-rapidapi-host': 'youtube-mp4-mp3-downloader.p.rapidapi.com'
					}
				});
			}

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

			let finalStream: ReadableStream | null = null;

			// Obfuscate using Cloudflare Containers
			if (this.env.OBFUSCATOR) {
				console.log("Sending download URL to Obfuscator Container to bypass Worker memory limits...");
				const containerInstance = getContainer(this.env.OBFUSCATOR, "global");
				
				// Call the container's /process_url endpoint with the URL
				const obsRes = await containerInstance.fetch("http://container/process_url", {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ downloadUrl })
				});
				
				if (!obsRes.ok) {
					const errText = await obsRes.text();
					console.error("Container processing failed", errText);
					throw new Error(`Container processing failed: ${obsRes.status} ${obsRes.statusText} - ${errText}`);
				}
				
				// Use the streaming body directly so we don't blow up the Worker's memory!
				finalStream = obsRes.body;
				console.log("Video successfully obfuscated natively on Cloudflare!");
			} else {
				throw new Error("OBFUSCATOR container is not configured! Cannot process video.");
			}
			
			const objectKey = `${selectedVideo.videoId}.mp4`;
			await this.env.VIDEOS_BUCKET.put(objectKey, finalStream, {
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

		// Step 8: AI Video Upscaling via Replicate
		if (this.env.REPLICATE_API_TOKEN) {
			await step.do('upscale-video', async () => {
				const videoUrl = `https://aviation-curator.samueladu1970.workers.dev/api/video/${selectedVideo.videoId}`;
				console.log(`Sending video to Replicate for AI upscaling: ${videoUrl}`);
				
				const repRes = await fetch("https://api.replicate.com/v1/predictions", {
					method: "POST",
					headers: {
						"Authorization": `Bearer ${this.env.REPLICATE_API_TOKEN}`,
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						version: "018a4146a848a604cc7d3c054238e55e09f7a7ebc447a118181cc00d11019d0d", // Example: cjwbw/video-restoration model
						input: {
							video: videoUrl,
							enhance_faces: false,
							upscale: 2
						}
					})
				});

				if (!repRes.ok) {
					console.error("Replicate API failed", await repRes.text());
				} else {
					console.log("Video successfully queued for AI Upscaling!");
					// In a real production setup, we would setup a webhook or poll for the result here.
				}
			});
		}

		// Step 9: Post to TikTok via Ayrshare
		if (this.env.AYRSHARE_API_KEY) {
			await step.do('post-tiktok', async () => {
				const videoUrl = `https://aviation-curator.samueladu1970.workers.dev/api/video/${selectedVideo.videoId}`;
				
				const payload = {
					post: caption,
					platforms: ["tiktok"],
					mediaUrls: [videoUrl],
					tiktokOptions: {
						privacyLevel: "public",
						disableComment: false,
						disableDuet: false,
						disableStitch: false
					}
				};

				const ayrRes = await fetch("https://app.ayrshare.com/api/post", {
					method: "POST",
					headers: {
						"Authorization": `Bearer ${this.env.AYRSHARE_API_KEY}`,
						"Content-Type": "application/json"
					},
					body: JSON.stringify(payload)
				});

				if (!ayrRes.ok) {
					console.error("TikTok Ayrshare posting failed", await ayrRes.text());
				} else {
					console.log("Successfully auto-posted to TikTok!");
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
	},
	async scheduled(event: any, env: Env, ctx: ExecutionContext) {
		console.log("Cron triggered! Starting workflow...");
		const instance = await env.MY_WORKFLOW.create();
		console.log("Workflow started with ID:", instance.id);
	}
};
