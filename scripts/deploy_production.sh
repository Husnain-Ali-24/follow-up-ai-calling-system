#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/follow-up-ai-calling-system}"
BRANCH="${BRANCH:-main}"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Repository not found at $APP_DIR"
  exit 1
fi

cd "$APP_DIR"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

docker compose pull --ignore-pull-failures
DOCKER_BUILDKIT=1 docker compose up -d --build
docker compose ps
