#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Apply database migrations"
cd backend
npm exec prisma -- migrate deploy

echo "==> Generate Prisma Client"
npm exec prisma -- generate
cd ..

echo "==> Migrations finished"
