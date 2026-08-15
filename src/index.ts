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
	ZERNIO_API_KEY?: string;
}

export class ObfuscatorContainer extends Container {
    defaultPort = 3000;
}

export class AviationCuratorWorkflow extends WorkflowEntrypoint<Env, any> {
	async run(event: WorkflowEvent<any>, step: WorkflowStep) {
		// Dynamic TikTok Niche Discovery Array (Algorithms love these)
		const trendingNiches = [
			{ niche: 'aviation', queries: ['a380 takeoff', 'boeing 747 landing', 'fighter jet sonic boom', 'cockpit view takeoff'] },
			{ niche: 'cyprus_tourism', queries: ['cyprus beaches 4k', 'ayia napa drone 4k', 'cyprus crystal clear water', 'cyprus blue lagoon akamas', 'cyprus sea caves travel'] },
			{ niche: 'cyprus_lifestyle', queries: ['limassol marina luxury', 'cyprus luxury villas', 'living in cyprus expat', 'cyprus food culture', 'paphos cyprus walking tour 4k'] },
			{ niche: 'tech_gadgets', queries: ['coolest amazon finds tech', 'smartphone unboxing ASMR', 'crazy japanese gadgets', 'tech you need under $50'] },
			{ niche: 'oddly_satisfying', queries: ['kinetic sand cutting', 'soap carving ASMR', 'power washing porn', 'satisfying factory machines'] },
			{ niche: 'dark_psychology', queries: ['body language secrets', 'dark psychology tricks', 'how to read people', 'manipulation techniques to watch out for'] },
			{ niche: 'luxury_lifestyle', queries: ['monaco billionaire lifestyle', 'superyacht tour', 'dubai luxury cars', 'billionaire penthouses'] }
		];
		const selectedCategory = trendingNiches[Math.floor(Math.random() * trendingNiches.length)];
		const keyword = selectedCategory.queries[Math.floor(Math.random() * selectedCategory.queries.length)];
		const activeNiche = selectedCategory.niche;

		// Step 1: Search YouTube
		const searchResults = await step.do('search-youtube', async () => {
			if (!this.env.YOUTUBE_API_KEY) throw new Error("Missing YOUTUBE_API_KEY");
			const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&videoDuration=short&maxResults=50&relevanceLanguage=en&key=${this.env.YOUTUBE_API_KEY}`;
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
			const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids}&key=${this.env.YOUTUBE_API_KEY}`;
			const res = await fetch(url);
			if (!res.ok) throw new Error(`YouTube Stats failed: ${res.statusText}`);
			const data = await res.json() as any;
			
			const itemsMap = new Map();
			for (const item of data.items) {
				itemsMap.set(item.id, item);
			}

			// Helper to parse ISO 8601 duration like PT58S or PT1M12S to seconds
			const parseDuration = (iso: string): number => {
				const match = iso.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
				if (!match) return 60;
				const minutes = parseInt(match[1] || '0');
				const seconds = parseInt(match[2] || '0');
				return minutes * 60 + seconds;
			};

			const gems = [];
			for (const video of unseenVideos) {
				const item = itemsMap.get(video.videoId);
				if (!item) continue;
				const stats = item.statistics;
				const snippet = item.snippet;
				const contentDetails = item.contentDetails;

				const durationSec = contentDetails?.duration ? parseDuration(contentDetails.duration) : 60;
				// Prefer videos between 10s and 90s (optimal TikTok Short length)
				if (durationSec > 90) continue;

				// Attach clean full title, description, and tags
				video.title = snippet.title || video.title;
				video.description = snippet.description || '';
				video.tags = snippet.tags || [];

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
			const rawTitle = selectedVideo.title || '';
			const cleanTitle = rawTitle.replace(/[#@][\w-]+/g, '').trim();
			
			const prompt = `Creator's Original Video Title: "${rawTitle}"\nClean Subject: "${cleanTitle}"\nCategory: "${activeNiche.replace('_', ' ')}"\n\nFormat this video's title into a clean, punchy 2-line TikTok caption. Use the creator's EXACT words and topic. Do NOT invent actions, adjectives, or stories.`;
			
			const systemMessage = `You are a social media copy editor. Your job is to format the video title into a clean TikTok caption.

CRITICAL INSTRUCTIONS:
1. Base the caption 100% on the creator's EXACT words in the title.
2. DO NOT invent imaginary descriptions (do NOT say "gentle strokes", "mesmerizing patterns", "carving designs", or make up actions not stated in the title).
3. Output format:
Line 1: Cleaned version of the title
Line 2: 1 simple question or call to action
End with 2-3 relevant hashtags from the category.

Keep total caption under 150 characters.`;

			const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
				messages: [
					{ role: 'system', content: systemMessage },
					{ role: 'user', content: prompt }
				]
			});
			
			const generatedText = (response as any).response?.trim();
			return generatedText || cleanTitle || rawTitle;
		});

		// Step 5: Download Video via yt-dlp & Upload to R2
		const r2Key = await step.do('download-and-store', async () => {
			let finalStream: ReadableStream | null = null;

			if (this.env.OBFUSCATOR) {
				console.log("Fetching download URL from RapidAPI...");
				const rapidApiUrl = `https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1/download?format=720&id=${selectedVideo.videoId}&audioQuality=128&addInfo=false&allowExtendedDuration=false`;
				const rapidApiRes = await fetch(rapidApiUrl, {
					method: 'GET',
					headers: {
						'x-rapidapi-key': 'ac8ba431dbmsh17931b53670dd9ap12864ejsn321a6756a503',
						'x-rapidapi-host': 'youtube-mp4-mp3-downloader.p.rapidapi.com',
						'Content-Type': 'application/json'
					}
				});
				
				if (!rapidApiRes.ok) {
					throw new Error(`RapidAPI failed: ${rapidApiRes.status} ${await rapidApiRes.text()}`);
				}
				
				const rapidApiData = await rapidApiRes.json();
				let videoUrl = rapidApiData.url;
				
				if (!videoUrl && rapidApiData.progressId) {
					console.log(`RapidAPI returned progressId: ${rapidApiData.progressId}. Polling for completion...`);
					let isFinished = false;
					while (!isFinished) {
						await new Promise(r => setTimeout(r, 3000));
						const progressRes = await fetch(`https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1/progress?id=${rapidApiData.progressId}`, {
							headers: {
								'x-rapidapi-key': 'ac8ba431dbmsh17931b53670dd9ap12864ejsn321a6756a503',
								'x-rapidapi-host': 'youtube-mp4-mp3-downloader.p.rapidapi.com'
							}
						});
						if (!progressRes.ok) throw new Error("Failed to check progress");
						const progressData = await progressRes.json();
						
						if (progressData.finished) {
							videoUrl = progressData.downloadUrl || progressData.url;
							isFinished = true;
						} else {
							console.log(`Progress: ${progressData.progress || 0}`);
						}
					}
				}
				
				if (!videoUrl) {
					throw new Error("RapidAPI response missing url: " + JSON.stringify(rapidApiData));
				}

				console.log("Fetching direct video stream...");
				const mp4Res = await fetch(videoUrl);
				if (!mp4Res.ok) throw new Error("Failed to download MP4 from RapidAPI url");

				console.log("Streaming direct MP4 to Obfuscator Container for FFmpeg processing...");
				const containerInstance = getContainer(this.env.OBFUSCATOR, "global");
				
				// Post the stream directly to the container
				const obsRes = await containerInstance.fetch("http://container/download_and_obfuscate", {
					method: 'POST',
					body: mp4Res.body,
					headers: {
						'Content-Type': 'application/octet-stream'
					}
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
			
			if (finalStream) {
				const multipartUpload = await this.env.VIDEOS_BUCKET.createMultipartUpload(objectKey, {
					httpMetadata: { contentType: 'video/mp4' }
				});
				
				try {
					const reader = finalStream.getReader();
					let partNumber = 1;
					let chunks = [];
					let currentSize = 0;
					const MIN_PART_SIZE = 5 * 1024 * 1024; // 5MB limit for R2 parts
					const uploadedParts = [];
					
					while (true) {
						const { done, value } = await reader.read();
						
						if (value) {
							chunks.push(value);
							currentSize += value.byteLength;
						}
						
						if (currentSize >= MIN_PART_SIZE || (done && currentSize > 0)) {
							const combined = new Uint8Array(currentSize);
							let offset = 0;
							for (const chunk of chunks) {
								combined.set(chunk, offset);
								offset += chunk.byteLength;
							}
							
							const part = await multipartUpload.uploadPart(partNumber, combined);
							uploadedParts.push(part);
							
							partNumber++;
							chunks = [];
							currentSize = 0;
						}
						
						if (done) break;
					}
					
					// R2 requires at least one part to be uploaded even if it's empty, or you can just abort
					if (uploadedParts.length === 0) {
					    const part = await multipartUpload.uploadPart(1, new Uint8Array(0));
					    uploadedParts.push(part);
					}
					
					await multipartUpload.complete(uploadedParts);
				} catch (err) {
					await multipartUpload.abort();
					throw err;
				}
			}
			
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
				// Read the video from R2 into a buffer so we can upload it directly to Telegram
				const videoObject = await this.env.VIDEOS_BUCKET.get(r2Key);
				if (!videoObject) throw new Error('Video not found in R2');
				const videoArrayBuffer = await videoObject.arrayBuffer();
				const videoBlob = new Blob([videoArrayBuffer], { type: 'video/mp4' });
				console.log(`Uploading ${r2Key} to Telegram (${(videoArrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB)...`);

				const formData = new FormData();
				formData.append('chat_id', this.env.TELEGRAM_CHAT_ID);
				formData.append('caption', caption);
				formData.append('video', videoBlob, `${selectedVideo.videoId}.mp4`);

				const tgUrl = `https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendVideo`;
				const tgRes = await fetch(tgUrl, {
					method: 'POST',
					body: formData
				});

				const tgBody = await tgRes.text();
				if (!tgRes.ok) {
					console.error(`Telegram upload failed [${tgRes.status}]:`, tgBody);
					throw new Error(`Failed to post to Telegram: ${tgBody}`);
				}
				console.log('Successfully posted to Telegram!', tgBody);
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

		// Step 9: Post to TikTok via Zernio (or Ayrshare)
		if (this.env.ZERNIO_API_KEY) {
			await step.do('post-tiktok-zernio', async () => {
				const videoUrl = `https://aviation-curator.samueladu1970.workers.dev/api/video/${selectedVideo.videoId}`;
				console.log(`Submitting video to Zernio TikTok: ${videoUrl}`);

				// Step 9a: Fetch connected TikTok account ID
				const accRes = await fetch("https://api.zernio.com/v1/accounts", {
					headers: { "Authorization": `Bearer ${this.env.ZERNIO_API_KEY}` }
				});
				if (!accRes.ok) throw new Error(`Zernio accounts lookup failed: ${accRes.statusText}`);
				const accData = await accRes.json() as any;
				const tiktokAcc = (accData.accounts || []).find((a: any) => a.platform === 'tiktok' && a.enabled);

				if (!tiktokAcc) {
					console.warn("No active TikTok account found connected in Zernio profile.");
					return { status: "skipped", reason: "no_tiktok_account" };
				}

				const payload = {
					content: caption,
					platforms: [{ platform: "tiktok", accountId: tiktokAcc._id }],
					mediaItems: [{ type: "video", url: videoUrl }],
					publishNow: true
				};

				const postRes = await fetch("https://zernio.com/api/v1/posts", {
					method: "POST",
					headers: {
						"Authorization": `Bearer ${this.env.ZERNIO_API_KEY}`,
						"Content-Type": "application/json"
					},
					body: JSON.stringify(payload)
				});

				const postData = await postRes.text();
				console.log("Zernio TikTok response:", postData);
				return JSON.parse(postData);
			});
		} else if (this.env.AYRSHARE_API_KEY) {
			await step.do('post-tiktok', async () => {
				const videoUrl = `https://aviation-curator.samueladu1970.workers.dev/api/video/${selectedVideo.videoId}`;
				console.log(`Submitting video to Ayrshare TikTok: ${videoUrl}`);

				const payload = {
					post: caption,
					platforms: ["tiktok"],
					mediaUrls: [videoUrl],
					tikTokOptions: {
						privacyLevel: "SELF_ONLY",
						visibility: "private",
						disableComments: false,
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

				const ayrData = await ayrRes.text();
				console.log("Ayrshare response:", ayrData);

				if (!ayrRes.ok) {
					console.warn(`TikTok Ayrshare notice [${ayrRes.status}]: ${ayrData}`);
					return { status: "error", message: ayrData };
				}
				
				return JSON.parse(ayrData);
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
			
			const object = await env.VIDEOS_BUCKET.get(`${videoId}.mp4`, {
				range: request.headers,
				onlyIf: request.headers,
			});
			if (!object) return new Response('Not found', { status: 404 });
			
			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set('etag', object.httpEtag);
			headers.set('Content-Type', 'video/mp4');
			headers.set('Access-Control-Allow-Origin', '*');
			headers.set('Accept-Ranges', 'bytes');

			// If range was requested and supported by R2
			if (object.range) {
				const { offset, length } = object.range as any;
				headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
				headers.set('Content-Length', length.toString());
				return new Response(object.body, { headers, status: 206 });
			}

			headers.set('Content-Length', object.size.toString());
			return new Response(object.body, { headers, status: 200 });
		}

		return new Response('Aviation Curator API', { status: 200 });
	},
	async scheduled(event: any, env: Env, ctx: ExecutionContext) {
		console.log("Cron triggered! Starting workflow...");
		const instance = await env.MY_WORKFLOW.create();
		console.log("Workflow started with ID:", instance.id);
	}
};
