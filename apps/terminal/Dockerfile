FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/terminal/package*.json ./
RUN npm ci
COPY apps/terminal/ .
EXPOSE 8001
CMD ["sh", "-c", "node server.js --port=${PORT:-8001}"]
