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

    const tmpInput = path.join('/tmp', `${timestamp}_in.mp4`);
    const tmpOutput = path.join('/tmp', `${timestamp}_out.mp4`);

    console.log(`[${timestamp}] Downloading video from RapidAPI proxy URL...`);

    const curl = spawn('curl', ['-L', '-A', 'Mozilla/5.0', '-o', tmpInput, downloadUrl]);

    curl.stderr.on('data', (data) => console.log(`[${timestamp} curl]: ${data.toString().trim()}`));

    curl.on('close', (curlCode) => {
        if (curlCode !== 0) {
            console.error(`[${timestamp}] curl failed with code ${curlCode}`);
            return res.status(500).send("Failed to download video URL");
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
