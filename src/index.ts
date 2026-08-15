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
		// Dynamic Trending Curation Matrix (Aviation, High-Tech ASMR, Cyprus Lifestyle)
		const trendingNiches = [
			{ niche: 'aviation', query: 'aviation', ytQueries: ['a380 takeoff', 'boeing 747 landing', 'fighter jet sonic boom', 'cockpit view takeoff'] },
			{ niche: 'oddly_satisfying', query: 'satisfying asmr', ytQueries: ['kinetic sand cutting', 'soap carving ASMR', 'power washing porn', 'satisfying factory machines'] },
			{ niche: 'tech_gadgets', query: 'cool gadgets', ytQueries: ['coolest amazon finds tech', 'smartphone unboxing ASMR', 'crazy japanese gadgets'] },
			{ niche: 'cyprus_tourism', query: 'cyprus travel', ytQueries: ['cyprus beaches 4k', 'ayia napa drone 4k', 'cyprus crystal clear water'] },
			{ niche: 'luxury_lifestyle', query: 'luxury cars penthouses', ytQueries: ['monaco billionaire lifestyle', 'superyacht tour', 'dubai luxury cars', 'billionaire penthouses'] }
		];
		const selectedCategory = trendingNiches[Math.floor(Math.random() * trendingNiches.length)];
		const activeNiche = selectedCategory.niche;

		// Step 1: Smart Multi-Source Discovery (TikTok Queue with strict Quota-Guard + YouTube 2K Fallback)
		const selectedVideo = await step.do('discover-video', async () => {
			// Sub-step 1a: Check if we have unused high-velocity clips in our local D1 TikTok Queue
			const queueItem = await this.env.DB.prepare(
				`SELECT * FROM tiktok_queue WHERE used = 0 ORDER BY likes DESC LIMIT 1`
			).first() as any;

			if (queueItem) {
				console.log(`[TikTok Queue] Using cached viral video from D1: ${queueItem.title} (${queueItem.views} views, ${queueItem.likes} likes)`);
				await this.env.DB.prepare(`UPDATE tiktok_queue SET used = 1 WHERE id = ?`).bind(queueItem.id).run();
				return {
					source: 'tiktok',
					videoId: queueItem.id,
					title: queueItem.title,
					downloadUrl: queueItem.play_url,
					author: queueItem.author,
					niche: queueItem.niche || activeNiche,
					soundId: queueItem.music_id,
					soundTitle: queueItem.music_title
				};
			}

			// Sub-step 1b: If queue is empty, make ONE quota-efficient batch call to TikTok Scraper (fetches 20 clips at once)
			console.log(`[TikTok Scout] Queue empty. Performing 1 batched discovery call for niche: ${selectedCategory.query}...`);
			try {
				const ttUrl = `https://tiktok-scraper7.p.rapidapi.com/feed/search?keywords=${encodeURIComponent(selectedCategory.query)}&count=20`;
				const ttRes = await fetch(ttUrl, {
					headers: {
						'x-rapidapi-key': 'ac8ba431dbmsh17931b53670dd9ap12864ejsn321a6756a503',
						'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
						'Content-Type': 'application/json'
					}
				});

				if (ttRes.ok) {
					const ttData = await ttRes.json() as any;
					const videos = ttData?.data?.videos || [];
					console.log(`[TikTok Scout] Retrieved ${videos.length} viral candidates in 1 single API call.`);

					if (videos.length > 0) {
						// Filter out videos we already published
						const ids = videos.map((v: any) => v.video_id || v.id).filter(Boolean);
						const placeholders = ids.map(() => '?').join(',');
						const { results } = await this.env.DB.prepare(
							`SELECT videoId FROM videos WHERE videoId IN (${placeholders})`
						).bind(...ids).all();
						const seenIds = new Set(results.map(r => r.videoId));

						const newVideos = videos.filter((v: any) => {
							const vid = v.video_id || v.id;
							return vid && !seenIds.has(vid) && v.play;
						});

						if (newVideos.length > 0) {
							// Batch-insert new videos into D1 Queue
							for (const v of newVideos) {
								const vid = v.video_id || v.id;
								try {
									await this.env.DB.prepare(
										`INSERT OR IGNORE INTO tiktok_queue (id, title, play_url, author, views, likes, music_id, music_title, niche, used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
									).bind(
										vid,
										v.title || '',
										v.play,
										v.author?.unique_id || '',
										v.play_count || 0,
										v.digg_count || 0,
										v.music_info?.id || '',
										v.music_info?.title || '',
										activeNiche
									).run();
								} catch (e) {
									console.warn("Queue insert error:", e);
								}
							}

							// Pick the top viral video from this fresh batch
							const picked = newVideos.sort((a: any, b: any) => (b.digg_count || 0) - (a.digg_count || 0))[0];
							const pickedId = picked.video_id || picked.id;
							await this.env.DB.prepare(`UPDATE tiktok_queue SET used = 1 WHERE id = ?`).bind(pickedId).run();

							return {
								source: 'tiktok',
								videoId: pickedId,
								title: picked.title || '',
								downloadUrl: picked.play,
								author: picked.author?.unique_id || '',
								niche: activeNiche,
								soundId: picked.music_info?.id || '',
								soundTitle: picked.music_info?.title || ''
							};
						}
					}
				}
			} catch (ttErr) {
				console.warn("[TikTok Scout] Error during discovery batch, falling back to YouTube 2K:", ttErr);
			}

			// Sub-step 1c: YouTube 2K Search Fallback
			console.log("[YouTube Scout] Discovering YouTube Shorts candidates...");
			const ytQuery = selectedCategory.ytQueries[Math.floor(Math.random() * selectedCategory.ytQueries.length)];
			const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(ytQuery)}&type=video&videoDuration=short&maxResults=30&relevanceLanguage=en&key=${this.env.YOUTUBE_API_KEY}`;
			const ytRes = await fetch(url);
			if (!ytRes.ok) throw new Error(`YouTube Search failed: ${ytRes.statusText}`);
			const ytData = await ytRes.json() as any;

			const candidates = ytData.items.map((item: any) => ({
				source: 'youtube',
				videoId: item.id.videoId,
				title: item.snippet.title,
				channelTitle: item.snippet.channelTitle,
				description: item.snippet.description,
				niche: activeNiche
			}));

			// Deduplicate against D1
			const ids = candidates.map((v: any) => v.videoId);
			const placeholders = ids.map(() => '?').join(',');
			const { results } = await this.env.DB.prepare(
				`SELECT videoId FROM videos WHERE videoId IN (${placeholders})`
			).bind(...ids).all();
			const seenIds = new Set(results.map(r => r.videoId));
			const unseen = candidates.filter((v: any) => !seenIds.has(v.videoId));

			if (unseen.length === 0) throw new Error("No unseen YouTube videos found for query: " + ytQuery);
			return unseen[Math.floor(Math.random() * unseen.length)];
		});

		// Step 2: Generate High-Converting UK Viral Caption with Workers AI
		const caption = await step.do('generate-caption', async () => {
			const rawTitle = selectedVideo.title || '';
			const cleanTitle = rawTitle.replace(/[#@][\w-]+/g, '').trim();
			
			const prompt = `Creator's Original Video Title: "${rawTitle}"\nClean Subject: "${cleanTitle}"\nCategory: "${selectedVideo.niche || activeNiche}"\n\nFormat this video's title into a clean, punchy 2-line UK TikTok caption. Use the creator's EXACT words and topic. Do NOT invent fake descriptions.`;
			
			const systemMessage = `You are a viral social media copy editor targeting UK and global FYP audiences.
CRITICAL INSTRUCTIONS:
1. Base the caption 100% on the creator's EXACT words in the title.
2. DO NOT invent imaginary descriptions or stories not stated in the title.
3. Output format:
Line 1: Cleaned version of the title
Line 2: 1 simple question or call to action
End with 2-3 relevant hashtags (e.g. #aviation #uktiktok #fyp).

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

		// Step 3: Download & Obfuscate Video via Container (with 2K -> 1080p -> 720p Resolution Ladder)
		const r2Key = await step.do('download-and-store', async () => {
			let finalStream: ReadableStream | null = null;
			let videoUrl = selectedVideo.downloadUrl;

			if (!videoUrl && selectedVideo.source === 'youtube') {
				console.log("Fetching download URL from RapidAPI (trying 2K 1440p -> 1080p -> 720p)...");
				const formats = ['1440', '1080', '720'];

				for (const fmt of formats) {
					try {
						const rapidApiUrl = `https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1/download?format=${fmt}&id=${selectedVideo.videoId}&audioQuality=128&addInfo=false&allowExtendedDuration=false`;
						const rapidApiRes = await fetch(rapidApiUrl, {
							method: 'GET',
							headers: {
								'x-rapidapi-key': 'ac8ba431dbmsh17931b53670dd9ap12864ejsn321a6756a503',
								'x-rapidapi-host': 'youtube-mp4-mp3-downloader.p.rapidapi.com',
								'Content-Type': 'application/json'
							}
						});

						if (!rapidApiRes.ok) {
							console.log(`Format ${fmt} returned HTTP ${rapidApiRes.status}, falling back...`);
							continue;
						}

						const rapidApiData = await rapidApiRes.json() as any;
						if (rapidApiData.url) {
							videoUrl = rapidApiData.url;
							console.log(`Successfully obtained direct ${fmt}p stream URL!`);
							break;
						} else if (rapidApiData.progressId) {
							console.log(`RapidAPI returned progressId for ${fmt}p: ${rapidApiData.progressId}. Polling...`);
							let isFinished = false;
							let pollAttempts = 0;
							while (!isFinished && pollAttempts < 15) {
								pollAttempts++;
								await new Promise(r => setTimeout(r, 2500));
								const progressRes = await fetch(`https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1/progress?id=${rapidApiData.progressId}`, {
									headers: {
										'x-rapidapi-key': 'ac8ba431dbmsh17931b53670dd9ap12864ejsn321a6756a503',
										'x-rapidapi-host': 'youtube-mp4-mp3-downloader.p.rapidapi.com'
									}
								});
								if (progressRes.ok) {
									const progressData = await progressRes.json() as any;
									if (progressData.finished) {
										videoUrl = progressData.downloadUrl || progressData.url;
										isFinished = true;
										console.log(`Finished ${fmt}p download preparation!`);
									}
								}
							}
							if (videoUrl) break;
						}
					} catch (fmtErr) {
						console.warn(`Error trying format ${fmt}:`, fmtErr);
					}
				}
			}

			if (!videoUrl) {
				throw new Error(`Failed to acquire video stream URL for video ${selectedVideo.videoId}`);
			}

			if (this.env.OBFUSCATOR) {
				console.log("Sending download URL to Obfuscator Container for direct download & FFmpeg processing...");
				const containerInstance = getContainer(this.env.OBFUSCATOR, "global");
				
				const obsRes = await containerInstance.fetch("http://container/process_url", {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ downloadUrl: videoUrl })
				});
				
				if (!obsRes.ok) {
					const errText = await obsRes.text();
					console.error("Container processing failed", errText);
					throw new Error(`Container processing failed: ${obsRes.status} ${obsRes.statusText} - ${errText}`);
				}
				
				finalStream = obsRes.body;
				console.log("Video successfully obfuscated natively on Cloudflare Container!");
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
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
			});
		}

		if (url.pathname.startsWith('/api/workflow-status/')) {
			const instanceId = url.pathname.split('/').pop();
			if (!instanceId) return new Response(JSON.stringify({ error: "Missing instance ID" }), { status: 400 });
			try {
				const instance = await env.MY_WORKFLOW.get(instanceId);
				const status = await instance.status();
				return new Response(JSON.stringify(status), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} catch (err: any) {
				return new Response(JSON.stringify({ error: err.message }), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
		}

		if (url.pathname === '/api/videos') {
			const { results } = await env.DB.prepare(
				`SELECT * FROM videos ORDER BY rowid DESC LIMIT 100`
			).all();
			return new Response(JSON.stringify(results), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
					'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
					'Pragma': 'no-cache',
					'Expires': '0'
				}
			});
		}

		// GET /api/queue — Fetch all mined TikTok clips waiting in backlog
		if (url.pathname === '/api/queue') {
			const { results } = await env.DB.prepare(
				`SELECT id, title, play_url, author, views, likes, music_title, niche, used, created_at FROM tiktok_queue ORDER BY likes DESC LIMIT 100`
			).all();
			return new Response(JSON.stringify(results), {
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
					'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
				}
			});
		}

		// POST /api/batch-mine-tiktok — Pull a custom batch (e.g. 10, 20, 30) of fresh viral clips from TikTok Scraper
		if (url.pathname === '/api/batch-mine-tiktok' && request.method === 'POST') {
			try {
				const body = await request.json().catch(() => ({})) as any;
				const count = Math.min(Math.max(body.count || 20, 5), 50);
				const query = body.query || 'aviation';
				const niche = body.niche || 'aviation';

				const ttUrl = `https://tiktok-scraper7.p.rapidapi.com/feed/search?keywords=${encodeURIComponent(query)}&count=${count}`;
				const ttRes = await fetch(ttUrl, {
					headers: {
						'x-rapidapi-key': 'ac8ba431dbmsh17931b53670dd9ap12864ejsn321a6756a503',
						'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
						'Content-Type': 'application/json'
					}
				});

				if (!ttRes.ok) {
					return new Response(JSON.stringify({ success: false, error: `TikTok API failed: ${ttRes.statusText}` }), {
						status: ttRes.status,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}

				const ttData = await ttRes.json() as any;
				const videos = ttData?.data?.videos || [];
				let insertedCount = 0;

				for (const v of videos) {
					const vid = v.video_id || v.id;
					if (!vid || !v.play) continue;
					try {
						await env.DB.prepare(
							`INSERT OR IGNORE INTO tiktok_queue (id, title, play_url, author, views, likes, music_id, music_title, niche, used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
						).bind(
							vid,
							v.title || '',
							v.play,
							v.author?.unique_id || '',
							v.play_count || 0,
							v.digg_count || 0,
							v.music_info?.id || '',
							v.music_info?.title || '',
							niche
						).run();
						insertedCount++;
					} catch (e) {}
				}

				return new Response(JSON.stringify({ success: true, countRetrieved: videos.length, insertedCount }), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} catch (err: any) {
				return new Response(JSON.stringify({ success: false, error: err.message }), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
		}

		if (url.pathname === '/api/publish-tiktok' && request.method === 'POST') {
			try {
				const body = await request.json() as any;
				const videoId = body.videoId;
				const caption = body.caption || "Watch this amazing video! #viral #fyp";
				if (!videoId) return new Response(JSON.stringify({ error: "Missing videoId" }), { status: 400 });

				const publicWorkerUrl = "https://aviation-curator.samueladu1970.workers.dev";
				const directVideoUrl = `${publicWorkerUrl}/api/video/${videoId}`;
				const zernioApiKey = env.ZERNIO_API_KEY || "sk_e3b92c869e26159068d93c7da38c251af58211ee52b55bea92e22dc1af7d19ad";

				// Fetch TikTok account details
				const accRes = await fetch("https://zernio.com/api/v1/accounts", {
					headers: { "Authorization": `Bearer ${zernioApiKey}` }
				});
				if (!accRes.ok) throw new Error("Failed to fetch Zernio accounts");
				const accData = await accRes.json() as any;
				const tiktokAcc = (accData.accounts || []).find((a: any) => a.platform === 'tiktok');
				if (!tiktokAcc) throw new Error("No TikTok account connected in Zernio");

				const zernioPayload = {
					content: caption,
					mediaItems: [{ type: "video", url: directVideoUrl }],
					platforms: [{
						platform: "tiktok",
						accountId: tiktokAcc._id || tiktokAcc.id
					}],
					publishNow: true
				};

				const postRes = await fetch("https://zernio.com/api/v1/posts", {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${zernioApiKey}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(zernioPayload)
				});
				const postData = await postRes.json();
				return new Response(JSON.stringify({ success: true, data: postData }), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} catch (err: any) {
				return new Response(JSON.stringify({ success: false, error: err.message }), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
		}

		if (url.pathname === '/api/publish-telegram' && request.method === 'POST') {
			try {
				const body = await request.json() as any;
				const videoId = body.videoId;
				const caption = body.caption || "Curated Video";
				if (!videoId) return new Response(JSON.stringify({ error: "Missing videoId" }), { status: 400 });

				const videoObject = await env.VIDEOS_BUCKET.get(`${videoId}.mp4`);
				if (!videoObject) return new Response(JSON.stringify({ error: "Video not found in R2" }), { status: 404 });

				const videoArrayBuffer = await videoObject.arrayBuffer();
				const videoBlob = new Blob([videoArrayBuffer], { type: 'video/mp4' });

				const formData = new FormData();
				formData.append('chat_id', env.TELEGRAM_CHAT_ID);
				formData.append('caption', caption);
				formData.append('video', videoBlob, `${videoId}.mp4`);

				const tgUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendVideo`;
				const tgRes = await fetch(tgUrl, {
					method: 'POST',
					body: formData
				});
				const tgData = await tgRes.json();
				return new Response(JSON.stringify({ success: tgRes.ok, data: tgData }), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			} catch (err: any) {
				return new Response(JSON.stringify({ success: false, error: err.message }), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
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

		// GET /api/stream-proxy?url=... — Proxy raw TikTok CDN video streams for browser preview
		if (url.pathname === '/api/stream-proxy') {
			const targetUrl = url.searchParams.get('url');
			if (!targetUrl) return new Response('Missing url parameter', { status: 400 });

			try {
				const proxyRes = await fetch(targetUrl, {
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
						'Referer': 'https://www.tiktok.com/'
					}
				});

				if (!proxyRes.ok) {
					return new Response(`Proxy error: ${proxyRes.status}`, { status: proxyRes.status });
				}

				const headers = new Headers();
				headers.set('Content-Type', 'video/mp4');
				headers.set('Access-Control-Allow-Origin', '*');
				headers.set('Accept-Ranges', 'bytes');
				const cl = proxyRes.headers.get('Content-Length');
				if (cl) headers.set('Content-Length', cl);

				return new Response(proxyRes.body, { headers, status: 200 });
			} catch (e: any) {
				return new Response(`Proxy exception: ${e.message}`, { status: 500 });
			}
		}

		return new Response('Aviation Curator API', { status: 200 });
	},
	async scheduled(event: any, env: Env, ctx: ExecutionContext) {
		console.log("Cron triggered! Starting workflow...");
		const instance = await env.MY_WORKFLOW.create();
		console.log("Workflow started with ID:", instance.id);
	}
};
