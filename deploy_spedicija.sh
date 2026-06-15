#!/usr/bin/env bash
set -euo pipefail

APP_NAME="spedicija-backend"
APP_PORT="8590"
BRANCH="main"

cd "$(dirname "$0")"

echo "==> Pull latest code"
git pull --ff-only origin "$BRANCH"

echo "==> Install root dependencies"
npm ci

echo "==> Install backend dependencies"
npm ci --prefix backend

echo "==> Install frontend dependencies"
npm ci --prefix frontend

echo "==> Generate Prisma Client"
npm run prisma:generate

echo "==> Build frontend"
npm run build

echo "==> Restart backend PM2 app"
cd backend
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  PORT="$APP_PORT" pm2 restart "$APP_NAME" --update-env
else
  PORT="$APP_PORT" pm2 start npm --name "$APP_NAME" -- start
fi
cd ..

pm2 save

echo "==> Check backend health"
for attempt in {1..10}; do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/api/health"; then
    echo
    echo "==> Backend is responding"
    break
  fi

  if [ "$attempt" -eq 10 ]; then
    echo "ERROR: Backend did not respond on port ${APP_PORT}" >&2
    pm2 logs "$APP_NAME" --lines 40 --nostream
    exit 1
  fi

  echo "Waiting for backend to start (${attempt}/10)..."
  sleep 2
done

echo "==> Test Nginx configuration"
sudo nginx -t

echo "==> Reload Nginx"
sudo systemctl reload nginx

echo "==> Deploy finished"
