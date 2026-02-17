FROM node:22-slim AS builder
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/frontend/src/renderer/ /frontend-renderer/
COPY apps/frontend/src/shared/ /frontend-shared/
COPY apps/web/ .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 3000
ENV PORT=3000
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=8000
