FROM node:22-bullseye-slim
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "index.js"]
