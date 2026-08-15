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

app.post('/process', (req, res) => {
    const timestamp = Date.now();
    const videoId = req.body.videoId;
    
    if (!videoId) {
        return res.status(400).send("Missing videoId");
    }

    const tmpInput = path.join('/tmp', `${timestamp}_in.mp4`);
    const tmpOutput = path.join('/tmp', `${timestamp}_out.mp4`);

    console.log(`[${timestamp}] Starting yt-dlp download for ${videoId}...`);

    // Download best 1080p video + best audio directly to mp4
    const ytdlp = spawn('yt-dlp', [
        '-f', 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '-o', tmpInput,
        `https://www.youtube.com/watch?v=${videoId}`
    ]);

    ytdlp.stdout.on('data', (data) => console.log(`[${timestamp} yt-dlp]: ${data.toString().trim()}`));
    ytdlp.stderr.on('data', (data) => console.log(`[${timestamp} yt-dlp error]: ${data.toString().trim()}`));

    ytdlp.on('close', (ytdlpCode) => {
        if (ytdlpCode !== 0) {
            console.error(`[${timestamp}] yt-dlp failed with code ${ytdlpCode}`);
            return res.status(500).send("Download failed");
        }

        console.log(`[${timestamp}] Download complete. Running ffmpeg...`);
        
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
});

app.listen(PORT, () => {
    console.log(`Video obfuscator microservice listening on port ${PORT}`);
});
