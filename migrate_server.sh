#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Apply database migrations"
npm exec --prefix backend prisma -- migrate deploy

echo "==> Generate Prisma Client"
npm run prisma:generate

echo "==> Migrations finished"
