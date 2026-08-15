const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Increase timeout for long video processing
app.use((req, res, next) => {
    req.setTimeout(500000);
    res.setTimeout(500000);
    next();
});

app.use(express.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Run ffprobe on a file and return { width, height } of the video stream
function probeVideo(filePath) {
    return new Promise((resolve) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
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
                    resolve(vs ? { width: vs.width, height: vs.height } : null);
                } catch (e) { resolve(null); }
            } else { resolve(null); }
        });
    });
}

// Choose the right -vf filter based on source dimensions:
//   Portrait (height > width): scale to 1080x1920 with letterbox — avoids cropping portrait content
//   Landscape (width > height): scale to fill then center-crop — no black bars
function getVideoFilter(dims) {
    const isPortrait = dims && dims.height > dims.width;
    if (isPortrait) {
        // Portrait source (e.g. YouTube Shorts 360x640, 1080x1920)
        // Scale to fit 1080x1920 preserving AR — for exact 9:16 no padding needed
        return 'eq=saturation=1.1:contrast=1.05,unsharp=3:3:1.0,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:-1:-1:color=black,setsar=1,setpts=0.95*PTS';
    } else {
        // Landscape source (e.g. 1280x720, 1920x1080)
        // Scale to fill portrait frame, center-crop the excess
        return 'eq=saturation=1.1:contrast=1.05,unsharp=3:3:1.0,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,setpts=0.95*PTS';
    }
}

// Build the FFmpeg args array with consistent high-quality settings
function buildFfmpegArgs(input, vf, output) {
    return [
        '-y',
        '-i', input,
        '-vf', vf,
        '-pix_fmt', 'yuv420p',
        '-af', 'atempo=1.05',
        '-c:v', 'libx264',
        '-preset', 'veryfast', // Fast execution while CRF 18 ensures crystal-clear visual quality
        '-crf', '18',          // Near-lossless visual quality (was 24)
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        output
    ];
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

// POST /obfuscate — accepts raw video stream in request body
app.post('/obfuscate', (req, res) => {
    const timestamp = Date.now();
    const tmpInput = path.join('/tmp', `${timestamp}_in.mp4`);
    const tmpOutput = path.join('/tmp', `${timestamp}_out.mp4`);

    console.log(`[${timestamp}] /obfuscate: saving stream to disk...`);
    const writeStream = fs.createWriteStream(tmpInput);
    req.pipe(writeStream);

    writeStream.on('finish', async () => {
        const dims = await probeVideo(tmpInput);
        const vf = getVideoFilter(dims);
        console.log(`[${timestamp}] Source dims: ${dims ? dims.width + 'x' + dims.height : 'unknown'} → filter: ${isPortrait(dims) ? 'portrait' : 'landscape'}`);

        const ffmpeg = spawn('ffmpeg', buildFfmpegArgs(tmpInput, vf, tmpOutput));
        ffmpeg.stderr.on('data', d => console.log(`[${timestamp} ffmpeg]: ${d.toString().trim()}`));

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                res.download(tmpOutput, 'video.mp4', (err) => {
                    if (err) console.error(`[${timestamp}] Send error:`, err);
                    try { fs.unlinkSync(tmpInput); } catch(e) {}
                    try { fs.unlinkSync(tmpOutput); } catch(e) {}
                });
            } else {
                res.status(500).send('FFmpeg processing failed');
                try { fs.unlinkSync(tmpInput); } catch(e) {}
                try { fs.unlinkSync(tmpOutput); } catch(e) {}
            }
        });
    });

    writeStream.on('error', (err) => {
        console.error(`[${timestamp}] Write error:`, err);
        res.status(500).send('Failed to save input stream');
    });
});

// POST /process_url — accepts { downloadUrl } JSON body, streams via curl
app.post('/process_url', (req, res) => {
    const timestamp = Date.now();
    const { downloadUrl } = req.body;

    if (!downloadUrl) return res.status(400).send('Missing downloadUrl');

    const tmpInput = path.join('/tmp', `${timestamp}_in.mp4`);
    const tmpOutput = path.join('/tmp', `${timestamp}_out.mp4`);

    console.log(`[${timestamp}] /process_url: downloading via curl then probing...`);

    // Clean up any stale files in /tmp older than 10 minutes
    try {
        const files = fs.readdirSync('/tmp');
        const now = Date.now();
        for (const file of files) {
            const fp = path.join('/tmp', file);
            const stat = fs.statSync(fp);
            if (now - stat.mtimeMs > 600000) {
                fs.unlinkSync(fp);
            }
        }
    } catch(e) {}

    // Step 1: Download to disk via curl with timeout
    const curl = spawn('curl', ['-sL', '--max-time', '120', '-A', 'Mozilla/5.0', '-o', tmpInput, downloadUrl]);
    curl.stderr.on('data', d => console.log(`[${timestamp} curl]: ${d.toString().trim()}`));

    curl.on('close', async (curlCode) => {
        if (curlCode !== 0) {
            console.error(`[${timestamp}] curl failed with code ${curlCode}`);
            return res.status(500).send('Failed to download video');
        }

        const dims = await probeVideo(tmpInput);
        const vf = getVideoFilter(dims);
        console.log(`[${timestamp}] Source: ${dims ? dims.width + 'x' + dims.height : 'unknown'} → ${isPortrait(dims) ? 'portrait' : 'landscape'} path`);

        const ffmpeg = spawn('ffmpeg', buildFfmpegArgs(tmpInput, vf, tmpOutput));
        ffmpeg.stderr.on('data', d => console.log(`[${timestamp} ffmpeg]: ${d.toString().trim()}`));

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                res.download(tmpOutput, 'video.mp4', (err) => {
                    if (err) console.error(`[${timestamp}] Send error:`, err);
                    try { fs.unlinkSync(tmpInput); } catch(e) {}
                    try { fs.unlinkSync(tmpOutput); } catch(e) {}
                });
            } else {
                res.status(500).send('FFmpeg processing failed');
                try { fs.unlinkSync(tmpInput); } catch(e) {}
                try { fs.unlinkSync(tmpOutput); } catch(e) {}
            }
        });
    });
});

// POST /download_and_obfuscate — accepts raw video stream, main pipeline endpoint
app.post('/download_and_obfuscate', (req, res) => {
    const timestamp = Date.now();
    const tmpInput = path.join('/tmp', `${timestamp}_in.mp4`);
    const tmpOutput = path.join('/tmp', `${timestamp}_out.mp4`);

    console.log(`[${timestamp}] /download_and_obfuscate: saving stream to disk...`);
    const writeStream = fs.createWriteStream(tmpInput);
    req.pipe(writeStream);

    writeStream.on('finish', async () => {
        const dims = await probeVideo(tmpInput);
        const vf = getVideoFilter(dims);
        console.log(`[${timestamp}] Source: ${dims ? dims.width + 'x' + dims.height : 'unknown'} → ${isPortrait(dims) ? 'portrait' : 'landscape'} path | CRF 18 medium`);

        const ffmpeg = spawn('ffmpeg', buildFfmpegArgs(tmpInput, vf, tmpOutput));
        ffmpeg.stderr.on('data', d => console.log(`[${timestamp} ffmpeg]: ${d.toString().trim()}`));

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                res.download(tmpOutput, 'video.mp4', (err) => {
                    if (err) console.error(`[${timestamp}] Send error:`, err);
                    try { fs.unlinkSync(tmpInput); } catch(e) {}
                    try { fs.unlinkSync(tmpOutput); } catch(e) {}
                });
            } else {
                res.status(500).send('FFmpeg processing failed');
                try { fs.unlinkSync(tmpInput); } catch(e) {}
                try { fs.unlinkSync(tmpOutput); } catch(e) {}
            }
        });
    });

    writeStream.on('error', (err) => {
        console.error(`[${timestamp}] Write error:`, err);
        res.status(500).send('Failed to save input stream');
    });
});

// ─── Utility ──────────────────────────────────────────────────────────────────

function isPortrait(dims) {
    return dims && dims.height > dims.width;
}

app.listen(PORT, () => {
    console.log(`Video obfuscator listening on port ${PORT}`);
});
