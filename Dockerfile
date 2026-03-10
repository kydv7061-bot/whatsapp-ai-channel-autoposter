FROM node:22-bullseye-slim

RUN apt-get update && apt-get install -y \
    git \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

RUN printf '[url "https://github.com/"]\n\tinsteadOf = git+ssh://git@github.com/\n\tinsteadOf = ssh://git@github.com/\n\tinsteadOf = git@github.com:\n' > /root/.gitconfig

WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "index.js"]
