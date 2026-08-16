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
    const { script, brollUrls = [], voice = 'en-US-ChristopherNeural' } = req.body;

    if (!script) return res.status(400).send('Missing script');

    const tmpVoice = path.join('/tmp', `${timestamp}_voice.mp3`);
    const tmpVtt = path.join('/tmp', `${timestamp}_voice.vtt`);
    const tmpAss = path.join('/tmp', `${timestamp}_subtitles.ass`);
    const tmpOutput = path.join('/tmp', `${timestamp}_doc_out.mp4`);
    const brollFiles = [];

    console.log(`[${timestamp}] /render_documentary: Generating neural voiceover via edge-tts (${voice})...`);

    try {
        // Step 1: Generate Voiceover Audio & Word Subtitles via Edge-TTS
        await new Promise((resolve, reject) => {
            const edge = spawn('edge-tts', [
                '--voice', voice,
                '--text', script,
                '--write-media', tmpVoice,
                '--write-subtitles', tmpVtt
            ]);
            edge.stderr.on('data', d => console.log(`[edge-tts stderr]: ${d.toString()}`));
            edge.on('close', code => {
                if (code === 0) resolve();
                else reject(new Error(`edge-tts failed with code ${code}`));
            });
        });

        // Convert VTT to stylized ASS subtitles
        if (fs.existsSync(tmpVtt)) {
            const vttContent = fs.readFileSync(tmpVtt, 'utf8');
            const assContent = vttToAss(vttContent);
            fs.writeFileSync(tmpAss, assContent, 'utf8');
            console.log(`[${timestamp}] Stylized kinetic ASS subtitles generated!`);
        }

        // Measure exact voiceover duration
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
        });
        const totalDuration = voiceData;
        console.log(`[${timestamp}] Voiceover generated. Exact duration: ${totalDuration.toFixed(1)}s`);

        // Step 2: Download B-Roll Clips
        const validUrls = Array.isArray(brollUrls) ? brollUrls.filter(u => typeof u === 'string' && u.startsWith('http')) : [];
        if (validUrls.length === 0) {
            // Generate synthetic dynamic color background if no B-roll provided
            console.log(`[${timestamp}] No external B-roll provided, generating styled kinetic background...`);
        } else {
            console.log(`[${timestamp}] Downloading ${validUrls.length} B-roll video assets...`);
            for (let i = 0; i < Math.min(validUrls.length, 6); i++) {
                const brollPath = path.join('/tmp', `${timestamp}_broll_${i}.mp4`);
                const curl = spawn('curl', ['-sL', '--max-time', '60', '-A', 'Mozilla/5.0', '-o', brollPath, validUrls[i]]);
                await new Promise((resolve) => curl.on('close', resolve));
                if (fs.existsSync(brollPath) && fs.statSync(brollPath).size > 10000) {
                    brollFiles.push(brollPath);
                }
            }
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

            // Scale and crop each B-roll clip into vertical 720x1280 (HD vertical, fast render) with high saturation
            for (let i = 0; i < numClips; i++) {
                filterGraph += `[${i}:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,eq=saturation=1.15:contrast=1.08,trim=duration=${clipDuration.toFixed(2)},setpts=PTS-STARTPTS[v${i}];`;
            }

            // Concatenate all B-roll clips seamlessly
            filterGraph += `${brollFiles.map((_, i) => `[v${i}]`).join('')}concat=n=${numClips}:v=1:a=0[vconcat];`;

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
                '-crf', '24',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-pix_fmt', 'yuv420p',
                tmpOutput
            );
        } else {
            // Fallback to solid canvas if zero B-roll clips downloaded
            ffmpegArgs.push(
                '-f', 'lavfi',
                '-i', `color=c=0x0d1b2a:s=1080x1920:d=${totalDuration.toFixed(2)}`,
                '-i', tmpVoice
            );
            let filterGraph = `[0:v]null[vbg];`;
            if (fs.existsSync(tmpAss)) {
                const safeAss = tmpAss.replace(/'/g, "\\'").replace(/:/g, '\\:');
                filterGraph += `[vbg]ass='${safeAss}'[vfinal]`;
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
                '-crf', '22',
                '-c:a', 'aac',
                '-b:a', '192k',
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
                console.log(`[${timestamp}] Master render finished successfully! Sending MP4 stream...`);
                res.download(tmpOutput, 'documentary.mp4', (err) => {
                    if (err) console.error(`[${timestamp}] Download send error:`, err);
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
