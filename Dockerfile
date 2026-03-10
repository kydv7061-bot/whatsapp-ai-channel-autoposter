FROM node:22-bullseye-slim

RUN apt-get update && apt-get install -y \
    git \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "index.js"]
