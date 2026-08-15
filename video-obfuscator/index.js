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

app.post('/obfuscate', (req, res) => {
    const timestamp = Date.now();
    const tmpInput = path.join('/tmp', `${timestamp}_in.mp4`);
    const tmpOutput = path.join('/tmp', `${timestamp}_out.mp4`);

    console.log(`[${timestamp}] Starting obfuscation...`);

    const writeStream = fs.createWriteStream(tmpInput);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
        console.log(`[${timestamp}] Video saved to disk. Running ffmpeg...`);
        
        const ffmpeg = spawn('ffmpeg', [
            '-y',
            '-i', tmpInput,
            '-vf', 'eq=saturation=1.1:contrast=1.05,unsharp=3:3:1.0,crop=iw-16:ih-16,setpts=0.95*PTS',
            '-af', 'atempo=1.05',
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '16',
            '-c:a', 'aac',
            '-b:a', '192k',
            tmpOutput
        ]);

        ffmpeg.stderr.on('data', (data) => {
            console.log(`[${timestamp} ffmpeg]: ${data.toString().trim()}`);
        });

        ffmpeg.on('close', (code) => {
            console.log(`[${timestamp}] FFmpeg exited with code ${code}`);
            if (code === 0) {
                res.download(tmpOutput, 'video.mp4', (err) => {
                    if (err) console.error(`[${timestamp}] Error sending file:`, err);
                    try { fs.unlinkSync(tmpInput); } catch(e){}
                    try { fs.unlinkSync(tmpOutput); } catch(e){}
                });
            } else {
                res.status(500).send("FFmpeg processing failed");
                try { fs.unlinkSync(tmpInput); } catch(e){}
                try { fs.unlinkSync(tmpOutput); } catch(e){}
            }
        });
    });

    writeStream.on('error', (err) => {
        console.error(`[${timestamp}] Write stream error:`, err);
        res.status(500).send("Failed to save input stream");
    });
});

app.post('/process_url', (req, res) => {
    const timestamp = Date.now();
    const downloadUrl = req.body.downloadUrl;
    
    if (!downloadUrl) {
        return res.status(400).send("Missing downloadUrl");
    }

    const tmpOutput = path.join('/tmp', `${timestamp}_out.mp4`);

    console.log(`[${timestamp}] Streaming video from RapidAPI proxy URL to FFmpeg (writing to disk first)...`);

    // 1. Curl fetches the file and streams to stdout
    const curl = spawn('curl', ['-sL', '-A', 'Mozilla/5.0', downloadUrl]);
    
    // 2. FFmpeg reads from stdin and writes to tmpOutput
    const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-vf', 'eq=saturation=1.1:contrast=1.05,unsharp=3:3:1.0,crop=iw-16:ih-16,setpts=0.95*PTS',
        '-af', 'atempo=1.05',
        '-c:v', 'libx264',
        '-preset', 'veryfast', // Sped up significantly to prevent timeouts
        '-crf', '23',          // Optimized for TikTok
        '-c:a', 'aac',
        '-b:a', '128k',
        tmpOutput
    ]);

    // Pipe the data through the chain
    curl.stdout.pipe(ffmpeg.stdin);

    // Logging
    curl.stderr.on('data', (data) => console.log(`[${timestamp} curl]: ${data.toString().trim()}`));
    ffmpeg.stderr.on('data', (data) => console.log(`[${timestamp} ffmpeg]: ${data.toString().trim()}`));

    // Error handling
    curl.on('close', (curlCode) => {
        if (curlCode !== 0) console.error(`[${timestamp}] curl exited with code ${curlCode}`);
    });

    ffmpeg.on('close', (code) => {
        console.log(`[${timestamp}] FFmpeg exited with code ${code}`);
        if (code === 0) {
            res.download(tmpOutput, 'video.mp4', (err) => {
                if (err) console.error(`[${timestamp}] Error sending file:`, err);
                try { fs.unlinkSync(tmpOutput); } catch(e){}
            });
        } else {
            res.status(500).send("FFmpeg processing failed");
            try { fs.unlinkSync(tmpOutput); } catch(e){}
        }
    });
});

app.post('/download_and_obfuscate', (req, res) => {
    const timestamp = Date.now();
    const videoId = req.body.videoId;
    
    if (!videoId) {
        return res.status(400).send("Missing videoId");
    }

    const tmpOutput = path.join('/tmp', `${timestamp}_out.mp4`);
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    console.log(`[${timestamp}] Starting native yt-dlp download and obfuscation pipeline for ${youtubeUrl}`);

    // 1. yt-dlp fetches the highest quality mp4 stream and pipes to stdout (-o -)
    const ytdlp = spawn('yt-dlp', [
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '-o', '-', 
        youtubeUrl
    ]);
    
    // 2. FFmpeg reads from stdin and writes to tmpOutput
    const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-vf', 'eq=saturation=1.1:contrast=1.05,unsharp=3:3:1.0,crop=iw-16:ih-16,setpts=0.95*PTS',
        '-af', 'atempo=1.05',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        tmpOutput
    ]);

    // Pipe the data through the chain
    ytdlp.stdout.pipe(ffmpeg.stdin);

    // Logging
    ytdlp.stderr.on('data', (data) => console.log(`[${timestamp} yt-dlp]: ${data.toString().trim()}`));
    ffmpeg.stderr.on('data', (data) => console.log(`[${timestamp} ffmpeg]: ${data.toString().trim()}`));

    // Error handling
    ytdlp.on('close', (code) => {
        if (code !== 0) console.error(`[${timestamp}] yt-dlp exited with code ${code}`);
    });

    ffmpeg.on('close', (code) => {
        console.log(`[${timestamp}] FFmpeg exited with code ${code}`);
        if (code === 0) {
            res.download(tmpOutput, 'video.mp4', (err) => {
                if (err) console.error(`[${timestamp}] Error sending file:`, err);
                try { fs.unlinkSync(tmpOutput); } catch(e){}
            });
        } else {
            res.status(500).send("FFmpeg processing failed");
            try { fs.unlinkSync(tmpOutput); } catch(e){}
        }
    });
});

app.listen(PORT, () => {
    console.log(`Video obfuscator microservice listening on port ${PORT}`);
});
