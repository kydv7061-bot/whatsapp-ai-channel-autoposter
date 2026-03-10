# Dockerfile

FROM node:22-bullseye-slim

RUN apt-get update && \
    apt-get install -y chromium fonts-freefont-ttf git && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY . .

RUN npm install

CMD ["node", "index.js"]