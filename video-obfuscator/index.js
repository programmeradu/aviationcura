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

app.post('/obfuscate', (req, res) => {
    const timestamp = Date.now();
    const tmpInput = path.join('/tmp', `${timestamp}_in.mp4`);
    const tmpOutput = path.join('/tmp', `${timestamp}_out.mp4`);

    console.log(`[${timestamp}] Starting obfuscation...`);

    const writeStream = fs.createWriteStream(tmpInput);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
        console.log(`[${timestamp}] Video saved to disk. Running ffmpeg...`);
        
        // Obfuscation parameters:
        // -vf hflip (horizontal flip)
        // -vf eq=saturation=1.1 (boost saturation by 10%)
        // -vf crop=iw-10:ih-10 (slight crop to remove borders)
        // -af atempo=1.05 (speed up audio by 5%)
        // -vf setpts=0.95*PTS (speed up video by 5% to match audio)
        const ffmpeg = spawn('ffmpeg', [
            '-y',
            '-i', tmpInput,
            '-vf', 'hflip,eq=saturation=1.1,crop=iw-10:ih-10,setpts=0.95*PTS',
            '-af', 'atempo=1.05',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '18',
            '-c:a', 'aac',
            '-b:a', '192k',
            tmpOutput
        ]);

        ffmpeg.stderr.on('data', (data) => {
            // FFmpeg logs to stderr
            console.log(`[${timestamp} ffmpeg]: ${data.toString().trim()}`);
        });

        ffmpeg.on('close', (code) => {
            console.log(`[${timestamp}] FFmpeg exited with code ${code}`);
            if (code === 0) {
                res.download(tmpOutput, 'video.mp4', (err) => {
                    if (err) console.error(`[${timestamp}] Error sending file:`, err);
                    
                    // Cleanup tmp files
                    try { fs.unlinkSync(tmpInput); } catch(e){}
                    try { fs.unlinkSync(tmpOutput); } catch(e){}
                });
            } else {
                res.status(500).send("FFmpeg processing failed");
                try { fs.unlinkSync(tmpInput); } catch(e){}
            }
        });
    });

    writeStream.on('error', (err) => {
        console.error(`[${timestamp}] Write stream error:`, err);
        res.status(500).send("Failed to save input stream");
    });
});

app.listen(PORT, () => {
    console.log(`Video obfuscator microservice listening on port ${PORT}`);
});
