const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Increase timeout for long video rendering
app.use((req, res, next) => {
    req.setTimeout(600000);
    res.setTimeout(600000);
    next();
});

app.use(express.json({ limit: '50mb' }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Run ffprobe on a file and return { width, height, duration } of the video stream
function probeVideo(filePath) {
    return new Promise((resolve) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-show_format',
            filePath
        ]);
        let output = '';
        ffprobe.stdout.on('data', d => output += d.toString());
        ffprobe.stderr.on('data', () => {}); // suppress
        ffprobe.on('close', code => {
            if (code === 0) {
                try {
                    const data = JSON.parse(output);
                    const vs = data.streams.find(s => s.codec_type === 'video');
                    const duration = parseFloat(data.format?.duration || vs?.duration || '0');
                    resolve(vs ? { width: vs.width, height: vs.height, duration } : null);
                } catch (e) { resolve(null); }
            } else { resolve(null); }
        });
    });
}

function isPortrait(dims) {
    return dims && dims.height > dims.width;
}

// Convert VTT subtitle timing to ASS subtitle format with styled word highlights
function vttToAss(vttContent) {
    const lines = vttContent.split('\n');
    let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,68,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,2,2,40,40,650,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    let currentStart = '';
    let currentEnd = '';
    let currentText = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('-->')) {
            const parts = line.split('-->').map(p => p.trim());
            currentStart = formatAssTime(parts[0]);
            currentEnd = formatAssTime(parts[1]);
        } else if (line && !line.startsWith('WEBVTT') && !line.startsWith('NOTE') && !line.match(/^\d+$/)) {
            currentText = line.replace(/<[^>]+>/g, '').toUpperCase();
            if (currentStart && currentEnd && currentText) {
                // Add yellow emphasis styling
                ass += `Dialogue: 0,${currentStart},${currentEnd},Default,,0,0,0,,{\\c&H00FFFF&}${currentText}{\\c&HFFFFFF&}\n`;
                currentStart = '';
                currentEnd = '';
                currentText = '';
            }
        }
    }
    return ass;
}

// Build readable timed subtitle groups when the native speech service provides
// audio without a VTT sidecar. This keeps render timing deterministic and avoids
// another external request in the container path.
function scriptToAss(script, totalDuration) {
    const words = script.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const groupSize = 5;
    const groups = [];
    for (let i = 0; i < words.length; i += groupSize) {
        const groupWords = words.slice(i, i + groupSize);
        groups.push({
            text: groupWords.join(' '),
            weight: groupWords.reduce((sum, word) => sum + Math.max(1, word.replace(/[^A-Za-z0-9]/g, '').length), 0) +
                (/[.!?,;:]$/.test(groupWords[groupWords.length - 1]) ? 4 : 0)
        });
    }
    const totalWeight = groups.reduce((sum, group) => sum + group.weight, 0) || 1;
    let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,68,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,2,2,40,40,650,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    let cursor = 0;
    groups.forEach((group, index) => {
        const start = cursor;
        const end = index === groups.length - 1
            ? totalDuration
            : Math.min(totalDuration, cursor + (totalDuration * group.weight / totalWeight));
        const text = group.text.toUpperCase().replace(/[{}]/g, '');
        ass += `Dialogue: 0,${formatSecondsForAss(start)},${formatSecondsForAss(end)},Default,,0,0,0,,{\\c&H00FFFF&}${text}{\\c&HFFFFFF&}\n`;
        cursor = end;
    });
    return ass;
}

function formatSecondsForAss(seconds) {
    const totalCentiseconds = Math.max(0, Math.round(seconds * 100));
    const hours = Math.floor(totalCentiseconds / 360000);
    const minutes = Math.floor((totalCentiseconds % 360000) / 6000);
    const remaining = totalCentiseconds % 6000;
    const wholeSeconds = Math.floor(remaining / 100);
    const centiseconds = remaining % 100;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function formatAssTime(vttTime) {
    // 00:00:01.234 -> 0:00:01.23
    const parts = vttTime.split(':');
    let h = '0';
    let m = '00';
    let s = '00.00';
    if (parts.length === 3) {
        h = parseInt(parts[0], 10).toString();
        m = parts[1].padStart(2, '0');
        s = parseFloat(parts[2]).toFixed(2).padStart(5, '0');
    } else if (parts.length === 2) {
        m = parts[0].padStart(2, '0');
        s = parseFloat(parts[1]).toFixed(2).padStart(5, '0');
    }
    return `${h}:${m}:${s}`;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

// POST /render_documentary — Renders 100% Transformative AI Mini-Documentary
app.post('/render_documentary', async (req, res) => {
    const timestamp = Date.now();
    const { script, brollUrls = [], nativeAudioUrl } = req.body;

    if (!script) return res.status(400).send('Missing script');

    const tmpVoice = path.join('/tmp', `${timestamp}_voice.mp3`);
    const tmpVtt = path.join('/tmp', `${timestamp}_voice.vtt`);
    const tmpAss = path.join('/tmp', `${timestamp}_subtitles.ass`);
    const tmpOutput = path.join('/tmp', `${timestamp}_doc_out.mp4`);
    const brollFiles = [];

    console.log(`[${timestamp}] /render_documentary: Downloading native Workers AI voiceover...`);

    try {
        // Step 1: Download the MP3 generated by the Worker through the native
        // Workers AI binding. The network request has an explicit ceiling, unlike
        // the former external edge-tts subprocess which could hang indefinitely.
        if (!nativeAudioUrl || typeof nativeAudioUrl !== 'string' || !nativeAudioUrl.startsWith('http')) {
            throw new Error('Missing native Workers AI audio URL');
        }
        await new Promise((resolve, reject) => {
            const curl = spawn('curl', [
                '-fsSL', '--connect-timeout', '8', '--max-time', '35',
                '-o', tmpVoice, nativeAudioUrl
            ]);
            curl.on('close', code => code === 0 ? resolve() : reject(new Error(`Native audio download failed with code ${code}`)));
            curl.on('error', reject);
        });
        if (!fs.existsSync(tmpVoice) || fs.statSync(tmpVoice).size < 1000) {
            throw new Error('Native audio response was empty');
        }

        // Measure exact native voiceover duration, then generate deterministic
        // timed ASS subtitle groups from the completed script.
        const voiceData = await new Promise((resolve) => {
            const probe = spawn('ffprobe', ['-v', 'quiet', '-show_format', '-print_format', 'json', tmpVoice]);
            let out = '';
            probe.stdout.on('data', d => out += d.toString());
            probe.on('close', () => {
                try {
                    const parsed = JSON.parse(out);
                    resolve(parseFloat(parsed.format?.duration || '45'));
                } catch(e) { resolve(45); }
            });
            probe.on('error', () => resolve(45));
        });
        const totalDuration = voiceData;
        fs.writeFileSync(tmpAss, scriptToAss(script, totalDuration), 'utf8');
        console.log(`[${timestamp}] Native voiceover ready. Exact duration: ${totalDuration.toFixed(1)}s`);

        // Step 2: Download B-Roll Clips (Max 3 clips, downloaded in parallel for speed).
        // A successful HTTP download is not enough: a missing R2 asset can still return an
        // HTML/JSON error page that happens to be larger than the old size threshold. Validate
        // each candidate with ffprobe before passing it to FFmpeg; the graphic fallback remains
        // reliable whenever the source library is unavailable.
        const validUrls = Array.isArray(brollUrls) ? brollUrls.filter(u => typeof u === 'string' && u.startsWith('http')) : [];
        const isPlayableVideo = (filePath) => new Promise((resolve) => {
            const probe = spawn('ffprobe', [
                '-v', 'error',
                '-select_streams', 'v:0',
                '-show_entries', 'stream=codec_type',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                filePath
            ]);
            let output = '';
            probe.stdout.on('data', d => output += d.toString());
            probe.on('close', code => resolve(code === 0 && output.trim() === 'video'));
            probe.on('error', () => resolve(false));
        });

        if (validUrls.length === 0) {
            console.log(`[${timestamp}] No external B-roll provided, generating styled kinetic background...`);
        } else {
            const urlsToFetch = validUrls.slice(0, 1);
            console.log(`[${timestamp}] Downloading ${urlsToFetch.length} B-roll video assets in parallel...`);
            await Promise.all(urlsToFetch.map((url, i) => new Promise((resolve) => {
                const brollPath = path.join('/tmp', `${timestamp}_broll_${i}.mp4`);
                const curl = spawn('curl', [
                    '-fsSL', '--connect-timeout', '8', '--max-time', '20',
                    '-A', 'Mozilla/5.0', '-o', brollPath, url
                ]);
                curl.on('close', async (code) => {
                    const playable = code === 0 && fs.existsSync(brollPath) &&
                        fs.statSync(brollPath).size > 10000 && await isPlayableVideo(brollPath);
                    if (playable) {
                        brollFiles.push(brollPath);
                    } else {
                        console.warn(`[${timestamp}] Ignoring unavailable or invalid B-roll source: ${url}`);
                        try { if (fs.existsSync(brollPath)) fs.unlinkSync(brollPath); } catch (e) {}
                    }
                    resolve();
                });
                curl.on('error', () => resolve());
            })));
        }

        if (brollFiles.length === 0) {
            console.log(`[${timestamp}] No playable B-roll clips found; using styled kinetic background fallback.`);
        }

        // Step 3: Construct Multi-Clip FFmpeg Filter Graph
        let ffmpegArgs = ['-y'];

        if (brollFiles.length > 0) {
            // Load each B-roll video input
            brollFiles.forEach(bf => ffmpegArgs.push('-stream_loop', '-1', '-i', bf));
            ffmpegArgs.push('-i', tmpVoice);

            const numClips = brollFiles.length;
            const clipDuration = totalDuration / numClips;
            let filterGraph = '';

            // Scale and crop the B-roll clip into a lightweight 540x960 vertical render with high saturation
            for (let i = 0; i < numClips; i++) {
                filterGraph += `[${i}:v]scale=540:960:force_original_aspect_ratio=increase,crop=540:960,setsar=1,fps=24,format=yuv420p,eq=saturation=1.12:contrast=1.05,trim=duration=${clipDuration.toFixed(2)},setpts=PTS-STARTPTS[v${i}];`;
            }

            // Use one verified clip for stability. The archive source files can carry
            // incompatible metadata that makes multi-input concat fail even after crop.
            if (numClips === 1) {
                filterGraph += `[v0]null[vconcat];`;
            } else {
                filterGraph += `${brollFiles.map((_, i) => `[v${i}]`).join('')}concat=n=${numClips}:v=1:a=0[vconcat];`;
            }

            // Burn kinetic subtitles if available, otherwise pass clean video
            if (fs.existsSync(tmpAss)) {
                const escapedPath = tmpAss.replace(/\\/g, '/').replace(/:/g, '\\:');
                filterGraph += `[vconcat]subtitles=filename='${escapedPath}'[vfinal]`;
            } else {
                filterGraph += `[vconcat]null[vfinal]`;
            }

            ffmpegArgs.push(
                '-filter_complex', filterGraph,
                '-map', '[vfinal]',
                '-map', `${numClips}:a`, // Voice audio
                '-t', totalDuration.toFixed(2),
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-tune', 'fastdecode',
                '-crf', '28',
                '-c:a', 'aac',
                '-b:a', '96k',
                '-pix_fmt', 'yuv420p',
                tmpOutput
            );
        } else {
            // Fallback to solid canvas if zero B-roll clips downloaded
            ffmpegArgs.push(
                '-f', 'lavfi',
                '-i', `color=c=0x0d1b2a:s=720x1280:d=${totalDuration.toFixed(2)}`,
                '-i', tmpVoice
            );
            let filterGraph = `[0:v]null[vbg];`;
            if (fs.existsSync(tmpAss)) {
                const escapedPath = tmpAss.replace(/\\/g, '/').replace(/:/g, '\\:');
                filterGraph += `[vbg]subtitles=filename='${escapedPath}'[vfinal]`;
            } else {
                filterGraph += `[vbg]null[vfinal]`;
            }
            ffmpegArgs.push(
                '-filter_complex', filterGraph,
                '-map', '[vfinal]',
                '-map', '1:a',
                '-t', totalDuration.toFixed(2),
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-tune', 'fastdecode',
                '-crf', '28',
                '-c:a', 'aac',
                '-b:a', '96k',
                '-pix_fmt', 'yuv420p',
                tmpOutput
            );
        }

        console.log(`[${timestamp}] Launching FFmpeg Master Render Engine...`);
        let ffmpegStderr = '';
        const ffmpeg = spawn('ffmpeg', ffmpegArgs);
        ffmpeg.stderr.on('data', d => {
            const str = d.toString();
            ffmpegStderr += str;
            console.log(`[ffmpeg render]: ${str.trim()}`);
        });

        ffmpeg.on('close', (code) => {
            if (code === 0 && fs.existsSync(tmpOutput)) {
                const fileSize = fs.statSync(tmpOutput).size;
                console.log(`[${timestamp}] Master render finished (${(fileSize / (1024*1024)).toFixed(2)} MB)! Streaming response...`);
                res.writeHead(200, {
                    'Content-Type': 'video/mp4',
                    'Content-Length': fileSize,
                    'Content-Disposition': 'inline; filename="documentary.mp4"'
                });
                const stream = fs.createReadStream(tmpOutput);
                stream.pipe(res);
                stream.on('end', () => cleanup());
                stream.on('error', (err) => {
                    console.error(`[${timestamp}] Stream error:`, err);
                    cleanup();
                });
            } else {
                console.error(`[${timestamp}] FFmpeg failed with code ${code}: ${ffmpegStderr.slice(-400)}`);
                res.status(500).send(`FFmpeg failed (${code}): ${ffmpegStderr.slice(-300)}`);
                cleanup();
            }
        });

    } catch (e) {
        console.error(`[${timestamp}] Render documentary exception:`, e);
        res.status(500).send(`Render failed: ${e.message}`);
        cleanup();
    }

    function cleanup() {
        try { if (fs.existsSync(tmpVoice)) fs.unlinkSync(tmpVoice); } catch(e) {}
        try { if (fs.existsSync(tmpVtt)) fs.unlinkSync(tmpVtt); } catch(e) {}
        try { if (fs.existsSync(tmpAss)) fs.unlinkSync(tmpAss); } catch(e) {}
        try { if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput); } catch(e) {}
        brollFiles.forEach(f => {
            try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch(e) {}
        });
    }
});

// Existing /obfuscate and /process_url endpoints for legacy compatibility
app.post('/process_url', (req, res) => {
    const timestamp = Date.now();
    const { downloadUrl } = req.body;
    if (!downloadUrl) return res.status(400).send('Missing downloadUrl');

    const tmpInput = path.join('/tmp', `${timestamp}_in.mp4`);
    const tmpOutput = path.join('/tmp', `${timestamp}_out.mp4`);

    const curl = spawn('curl', ['-sL', '--max-time', '120', '-A', 'Mozilla/5.0', '-o', tmpInput, downloadUrl]);
    curl.on('close', async (curlCode) => {
        if (curlCode !== 0) return res.status(500).send('Failed to download video');
        const dims = await probeVideo(tmpInput);
        const vf = isPortrait(dims)
            ? 'eq=saturation=1.1:contrast=1.05,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:-1:-1:color=black,setsar=1'
            : 'eq=saturation=1.1:contrast=1.05,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1';

        const ffmpeg = spawn('ffmpeg', ['-y', '-i', tmpInput, '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', tmpOutput]);
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                res.download(tmpOutput, 'video.mp4', () => {
                    try { fs.unlinkSync(tmpInput); } catch(e) {}
                    try { fs.unlinkSync(tmpOutput); } catch(e) {}
                });
            } else {
                res.status(500).send('FFmpeg failed');
                try { fs.unlinkSync(tmpInput); } catch(e) {}
                try { fs.unlinkSync(tmpOutput); } catch(e) {}
            }
        });
    });
});

app.listen(PORT, () => {
    console.log(`Transformative Video Engine listening on port ${PORT}`);
});
