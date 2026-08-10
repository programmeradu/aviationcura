FROM node:20-bullseye-slim

# Install ffmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
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
