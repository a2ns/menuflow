FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm rebuild better-sqlite3

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
