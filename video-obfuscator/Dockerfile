FROM node:20-bullseye-slim

# Install ffmpeg, python3, pip, curl, and essential fonts for subtitle rendering
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip curl fonts-freefont-ttf fonts-dejavu-core fonts-liberation && \
    pip3 install --no-cache-dir edge-tts && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install

# Copy application files
COPY index.js ./

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
