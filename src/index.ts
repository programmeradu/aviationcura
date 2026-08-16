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
		// Curated High-Velocity Niche Matrix (Aviation, Deep Sea, Micro-Restoration, Cyprus, Tech, Luxury, Psychology, ASMR)
		const trendingNiches = [
			{
				niche: 'aviation',
				query: 'cockpit crosswind landing aircraft carrier atc emergency',
				ytQueries: ['cockpit crosswind landing 4k', 'f18 catapult launch aircraft carrier', 'atc pilot emergency landing audio', 'fighter jet extreme low pass']
			},
			{
				niche: 'deep_sea_extreme',
				query: 'deep sea saturation diver north sea oil rig rogue wave',
				ytQueries: ['saturation diving dangerous work underwater', 'north sea rogue wave hitting ship', 'underwater welder deep ocean commercial diver', 'deepest oil rig saturation dive']
			},
			{
				niche: 'micro_restoration',
				query: 'rusty tool laser cleaning antique watchmaker restoration',
				ytQueries: ['high power laser rust removal satisfying', 'patek philippe restoration microscopic clockmaker', 'rusty antique machine complete restoration', 'vintage timepiece repair micro mechanical']
			},
			{
				niche: 'cyprus_tourism',
				query: 'cyprus travel ayia napa beaches 4k',
				ytQueries: ['cyprus beaches 4k', 'ayia napa drone 4k', 'cyprus crystal clear water']
			},
			{
				niche: 'cyprus_lifestyle',
				query: 'cyprus luxury villas beaches',
				ytQueries: ['cyprus luxury hotel', 'cyprus coastal villa', 'paphos luxury resorts']
			},
			{
				niche: 'tech_gadgets',
				query: 'cool amazon finds tech gadgets',
				ytQueries: ['coolest amazon finds tech', 'smartphone unboxing ASMR', 'crazy japanese gadgets']
			},
			{
				niche: 'oddly_satisfying',
				query: 'oddly satisfying asmr factory machines',
				ytQueries: ['kinetic sand cutting', 'soap carving ASMR', 'power washing porn', 'satisfying factory machines']
			},
			{
				niche: 'dark_psychology',
				query: 'psychological facts dark psychology',
				ytQueries: ['dark psychology facts', 'body language tricks', 'human psychology hacks']
			},
			{
				niche: 'luxury_lifestyle',
				query: 'dubai supercars billionaire penthouses',
				ytQueries: ['monaco billionaire lifestyle', 'superyacht tour', 'dubai luxury cars', 'billionaire penthouses']
			}
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
			const authorTag = selectedVideo.author ? `@${selectedVideo.author}` : '';
			
			const prompt = `Video Title: "${rawTitle}"\nSubject: "${cleanTitle}"\nOriginal Creator Handle: "${authorTag}"\nCategory: "${selectedVideo.niche || activeNiche}"\n\nTask: Write a clean 2-line curator caption for TikTok. Convert all first-person language ("I", "my", "me", "I'm") into neutral 3rd-person curator perspective ("This room tour...", "Watch this incredible...", "POV: Exploring..."). Never claim you are the person in the video. If an author handle exists, give credit (e.g. "via @creator").`;
			
			const systemMessage = `You are a professional social media curator page editor (like @pubity, @earth, @aviationdaily).
CRITICAL RULES:
1. PERSPECTIVE: ALWAYS write in third-person curator voice or neutral POV. NEVER use "I", "my", "we", "me", "I'm".
   - BAD: "I'm staying at Azia Resort in Paphos!"
   - GOOD: "Exploring the Azia Resort & Spa in Paphos, Cyprus ✨ Would you stay here?"
2. ACCURACY: Stay 100% faithful to what the video actually shows. Do not invent fictional backstories.
3. FORMAT (Max 150 characters):
   Line 1: Punchy descriptive hook (in 3rd person)
   Line 2: 1 interactive question for viewers + Creator credit if present (e.g. "🎥: @creator")
   End with 2-3 trending hashtags (#uktiktok #aviation #travel).`;

			const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
				messages: [
					{ role: 'system', content: systemMessage },
					{ role: 'user', content: prompt }
				]
			});
			
			const generatedText = (response as any).response?.trim();
			const fallbackCaption = authorTag ? `${cleanTitle}\n🎥: ${authorTag} #fyp #viral` : `${cleanTitle}\n#fyp #viral`;
			return generatedText || fallbackCaption;
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
			).bind(selectedVideo.videoId, selectedVideo.title, selectedVideo.niche || activeNiche, caption, r2Key, 'published').run();
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
				const publicWorkerUrl = "https://aviation-curator.samueladu1970.workers.dev";
				let videoUrl = `${publicWorkerUrl}/api/video/${selectedVideo.videoId}`;

				// If the video came from tiktok queue and not yet in R2, stream via proxy
				if (selectedVideo.downloadUrl && selectedVideo.source === 'tiktok') {
					videoUrl = `${publicWorkerUrl}/api/stream-proxy?url=${encodeURIComponent(selectedVideo.downloadUrl)}`;
				}

				console.log(`Submitting video to Zernio TikTok: ${videoUrl}`);

				// Step 9a: Fetch connected TikTok account ID
				const accRes = await fetch("https://zernio.com/api/v1/accounts", {
					headers: { "Authorization": `Bearer ${this.env.ZERNIO_API_KEY}` }
				});
				if (!accRes.ok) throw new Error(`Zernio accounts lookup failed: ${accRes.statusText}`);
				const accData = await accRes.json() as any;
				const tiktokAcc = (accData.accounts || []).find((a: any) => a.platform === 'tiktok' && (a.enabled !== false));

				if (!tiktokAcc) {
					console.warn("No active TikTok account found connected in Zernio profile.");
					return { status: "skipped", reason: "no_tiktok_account" };
				}

				const payload = {
					content: caption,
					platforms: [{ platform: "tiktok", accountId: tiktokAcc._id || tiktokAcc.id }],
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

		// GET /api/queue — Fetch all mined TikTok clips with real-time verified publication status
		if (url.pathname === '/api/queue') {
			try {
				const { results: queueItems } = await env.DB.prepare(
					`SELECT id, title, play_url, author, views, likes, music_title, niche, used, created_at FROM tiktok_queue ORDER BY likes DESC LIMIT 100`
				).all();

				// Fetch published posts directly from Zernio for source-of-truth accuracy
				const zernioApiKey = env.ZERNIO_API_KEY || "sk_e3b92c869e26159068d93c7da38c251af58211ee52b55bea92e22dc1af7d19ad";
				const zernioRes = await fetch("https://zernio.com/api/v1/posts", {
					headers: { "Authorization": `Bearer ${zernioApiKey}` }
				});

				const publishedVideoIds = new Set<string>();
				if (zernioRes.ok) {
					const zData = await zernioRes.json() as any;
					const posts = zData.posts || [];
					for (const p of posts) {
						if (p.status === 'published' || p.status === 'publishing') {
							const mediaUrl = p.mediaItems?.[0]?.url || '';
							// Check if mediaUrl matches queue ID directly or through stream-proxy
							for (const item of (queueItems as any[])) {
								if (mediaUrl.includes(item.id) || (item.play_url && mediaUrl.includes(encodeURIComponent(item.play_url)))) {
									publishedVideoIds.add(item.id);
								}
							}
						}
					}
				}

				const validatedQueue = (queueItems as any[]).map(item => ({
					...item,
					used: publishedVideoIds.has(item.id) ? 1 : 0
				}));

				return new Response(JSON.stringify(validatedQueue), {
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
						'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
					}
				});
			} catch (e: any) {
				return new Response(JSON.stringify({ error: e.message }), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
			}
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

		// POST /api/generate-caption — Generate 3rd-person curator caption with Workers AI on demand
		if (url.pathname === '/api/generate-caption' && request.method === 'POST') {
			try {
				const body = await request.json() as any;
				const rawTitle = body.title || '';
				const cleanTitle = rawTitle.replace(/[#@][\w-]+/g, '').trim();
				const authorTag = body.author ? `@${body.author}` : '';
				const niche = body.niche || 'aviation';

				const prompt = `Video Title: "${rawTitle}"\nSubject: "${cleanTitle}"\nOriginal Creator Handle: "${authorTag}"\nCategory: "${niche}"\n\nTask: Write a clean 2-line curator caption for TikTok. Convert all first-person language ("I", "my", "me", "I'm") into neutral 3rd-person curator perspective ("This room tour...", "Watch this incredible...", "POV: Exploring..."). Never claim you are the person in the video. If an author handle exists, give credit (e.g. "via @creator").`;
				
				const systemMessage = `You are a professional social media curator page editor (like @pubity, @earth, @aviationdaily).
CRITICAL RULES:
1. PERSPECTIVE: ALWAYS write in third-person curator voice or neutral POV. NEVER use "I", "my", "we", "me", "I'm".
2. ACCURACY: Stay 100% faithful to what the video actually shows. Do not invent fictional backstories.
3. FORMAT (Max 150 characters):
   Line 1: Punchy descriptive hook (in 3rd person)
   Line 2: 1 interactive question for viewers + Creator credit if present (e.g. "🎥: @creator")
   End with 2-3 trending hashtags (#uktiktok #aviation #travel).`;

				const aiRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
					messages: [
						{ role: 'system', content: systemMessage },
						{ role: 'user', content: prompt }
					]
				});

				const generatedText = (aiRes as any).response?.trim();
				const fallbackCaption = authorTag ? `${cleanTitle}\n🎥: ${authorTag} #fyp #viral` : `${cleanTitle}\n#fyp #viral`;
				return new Response(JSON.stringify({ success: true, caption: generatedText || fallbackCaption }), {
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
				let caption = body.caption;
				if (!videoId) return new Response(JSON.stringify({ error: "Missing videoId" }), { status: 400 });

				const publicWorkerUrl = "https://aviation-curator.samueladu1970.workers.dev";
				let directVideoUrl = `${publicWorkerUrl}/api/video/${videoId}`;

				// Check if video is already processed in R2
				const r2Obj = await env.VIDEOS_BUCKET.head(`${videoId}.mp4`);
				if (!r2Obj) {
					// Check if it is a queued TikTok video in tiktok_queue
					const queueItem = await env.DB.prepare(
						`SELECT play_url, title, author, niche FROM tiktok_queue WHERE id = ?`
					).bind(videoId).first() as any;

					if (queueItem && queueItem.play_url) {
						// Stream through proxy so TikTok's server receives a valid clean URL
						directVideoUrl = `${publicWorkerUrl}/api/stream-proxy?url=${encodeURIComponent(queueItem.play_url)}`;
						
						// If caption was not manually edited (equals raw title or empty), run Workers AI to generate 3rd person caption
						if (!caption || caption === queueItem.title) {
							try {
								const cleanTitle = (queueItem.title || '').replace(/[#@][\w-]+/g, '').trim();
								const authorTag = queueItem.author ? `@${queueItem.author}` : '';
								const prompt = `Video Title: "${queueItem.title}"\nSubject: "${cleanTitle}"\nOriginal Creator Handle: "${authorTag}"\nCategory: "${queueItem.niche || 'aviation'}"\n\nTask: Write a clean 2-line curator caption for TikTok in 3rd-person POV. Never use "I" or "my". Credit author via @handle.`;
								const systemMessage = `You are a professional social media curator editor. ALWAYS write in 3rd-person. Max 150 chars. Include 1 question + 🎥: @creator + 2-3 hashtags (#uktiktok #aviation #fyp).`;
								
								const aiRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
									messages: [
										{ role: 'system', content: systemMessage },
										{ role: 'user', content: prompt }
									]
								});
								const generated = (aiRes as any).response?.trim();
								if (generated) caption = generated;
							} catch (e) {}
						}
					}
				}

				if (!caption) caption = "Watch this incredible video! Rate this 1-10 🚀 #aviation #uktiktok #fyp";

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
				const postData = await postRes.json() as any;

				// Mark as used in tiktok_queue
				try {
					await env.DB.prepare(`UPDATE tiktok_queue SET used = 1 WHERE id = ?`).bind(videoId).run();
				} catch (e) {}

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
				if (!('body' in object)) return new Response(null, { status: 304 });

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

		// POST /api/documentary-topics — Return high-performing aviation story presets
		if (url.pathname === '/api/documentary-topics') {
			const topics = [
				{
					id: 'helios-522',
					title: 'The Ghost Flight: Helios Airways 522',
					summary: 'A Boeing 737 flies over Athens with everyone on board frozen unconscious at 35,000 feet.'
				},
				{
					id: 'gimli-glider',
					title: 'The Miracle of the Gimli Glider',
					summary: 'A Boeing 767 runs out of fuel at 41,000 feet and glides onto a drag-racing strip with zero casualties.'
				},
				{
					id: 'concorde-crash',
					title: 'The Fall of the Supersonic Legend: Concorde 4590',
					summary: 'A titanium strip on the runway sparks the tragic end of commercial supersonic flight.'
				},
				{
					id: 'sr71-speed-check',
					title: 'The Legendary SR-71 Blackbird Speed Check',
					summary: 'The ultimate radio silence flex across Los Angeles Center at Mach 3.2.'
				},
				{
					id: 'ba9-volcanic-ash',
					title: 'British Airways Flight 9: All 4 Engines Fail',
					summary: 'Flying through Mount Galunggung volcanic ash cloud at night with St. Elmo fire.'
				},
				{
					id: 'miracle-hudson',
					title: 'Cactus 1549: Miracle on the Hudson',
					summary: 'Double bird strike over NYC, landing a dual-engine disabled A320 safely on the river.'
				}
			];
			return new Response(JSON.stringify(topics), {
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
			});
		}

		// POST /api/generate-documentary — 100% Transformative AI Mini-Documentary Generator
		if (url.pathname === '/api/generate-documentary' && request.method === 'POST') {
			try {
				const body = await request.json().catch(() => ({})) as any;
				const topic = body.topic || 'Helios Airways Flight 522';
				const voice = body.voice || 'en-US-ChristopherNeural';

				console.log(`[Mini-Doc AI] Generating script for topic: ${topic}...`);

				// Step 1: Workers AI crafts a viral 60-second narrative script + B-Roll queries
				const systemPrompt = `You are a world-class documentary producer and aviation historian. 
Write a riveting, factual 60-second short-form documentary script about: "${topic}".
RULES:
1. First sentence must be an immediate psychological pattern-interrupt hook (e.g. "At 35,000 feet, the pilots were completely frozen.").
2. Narrative must build tension and explain what happened with 100% historical accuracy.
3. Total spoken words: between 120 and 150 words (approx 50-65 seconds of speech).
4. Do NOT include stage directions, speaker labels, or bracketed notes. Output ONLY the raw spoken text.
5. Provide 3 specific visual B-roll video search terms separated by commas on the very last line prefixed with "BROLL: "`;

				const aiRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: `Topic: ${topic}` }
					]
				});

				const aiText = ((aiRes as any).response || '').trim();
				const brollMatch = aiText.match(/BROLL:\s*(.+)$/i);
				let script = aiText.replace(/BROLL:\s*(.+)$/i, '').trim();
				// Remove markdown asterisks or formatting
				script = script.replace(/[*#]/g, '').trim();

				console.log(`[Mini-Doc AI] Script created (${script.split(/\s+/).length} words). Visual cues: ${brollMatch?.[1] || 'cockpit, airplane'}`);

				// Step 2: Select currently stored R2 videos for B-roll. The previous fixed
				// IDs eventually pointed to expired or unavailable objects, which allowed
				// error pages to reach the renderer as if they were MP4 files.
				const { results: brollRows } = await env.DB.prepare(
					`SELECT videoId FROM videos WHERE r2_url IS NOT NULL AND r2_url != '' ORDER BY rowid DESC LIMIT 3`
				).all<{ videoId: string }>();
				const brollCandidates = brollRows.map((row) =>
					`https://aviation-curator.samueladu1970.workers.dev/api/video/${encodeURIComponent(row.videoId)}`
				);

				// Step 3: Call Container to render full 1080x1920 video with neural voice & kinetic subtitles
				if (!env.OBFUSCATOR) {
					return new Response(JSON.stringify({ success: false, error: "Obfuscator container not bound" }), { status: 500 });
				}

				console.log(`[Mini-Doc AI] Sending script to Container Render Engine...`);
				const containerInstance = getContainer(env.OBFUSCATOR, "global");
				const renderRes = await containerInstance.fetch("http://container/render_documentary", {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						script,
						voice,
						brollUrls: brollCandidates
					})
				});

				if (!renderRes.ok) {
					const err = await renderRes.text();
					console.error("[Mini-Doc AI] Container rendering failed:", err);
					return new Response(JSON.stringify({ success: false, error: `Container render failed: ${err}` }), {
						status: 500,
						headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
					});
				}

				// Step 4: Stream rendered MP4 to R2
				const docId = `doc_${Date.now()}`;
				const objectKey = `${docId}.mp4`;
				const videoBody = renderRes.body;

				if (videoBody) {
					await env.VIDEOS_BUCKET.put(objectKey, videoBody, {
						httpMetadata: { contentType: 'video/mp4' }
					});
				}

				// Generate high-converting caption
				const caption = `✈️ ${topic}\nWatch the full breakdown 👆 What would you do in this situation?\n#aviation #pilot #history #avgeek #flight`;

				// Save into D1
				await env.DB.prepare(
					`INSERT INTO videos (videoId, title, keyword_used, humanized_caption, r2_url, status) VALUES (?, ?, ?, ?, ?, ?)`
				).bind(docId, topic, 'documentary', caption, objectKey, 'published').run();

				return new Response(JSON.stringify({
					success: true,
					videoId: docId,
					topic,
					script,
					caption,
					videoUrl: `https://aviation-curator.samueladu1970.workers.dev/api/video/${docId}`
				}), {
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});

			} catch (e: any) {
				console.error("[Mini-Doc AI] Exception:", e);
				return new Response(JSON.stringify({ success: false, error: e.message }), {
					status: 500,
					headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
				});
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
