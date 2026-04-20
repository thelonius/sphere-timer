#!/usr/bin/env bash
# Initial deploy & upgrade script for sphere-timer.
# Usage (on the target server, as root):
#   curl -fsSL https://raw.githubusercontent.com/thelonius/sphere-timer/claude/test-deploy-app-bATGZ/deploy.sh | bash
# or after clone:
#   cd /opt/sphere-timer && ./deploy.sh

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/thelonius/sphere-timer.git}"
BRANCH="${BRANCH:-claude/test-deploy-app-bATGZ}"
APP_DIR="${APP_DIR:-/opt/sphere-timer}"
SERVER_HOST="${SERVER_HOST:-91.84.112.120}"

say() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

# 1. Install Docker if missing
if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: 'docker compose' plugin is missing. Install docker-compose-plugin." >&2
  exit 1
fi

# 2. Clone or update repo
if [ -d "$APP_DIR/.git" ]; then
  say "Updating repo at $APP_DIR (branch: $BRANCH)"
  git -C "$APP_DIR" fetch --prune origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  say "Cloning $REPO_URL to $APP_DIR (branch: $BRANCH)"
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# 3. Persistent secrets (generated once, reused on upgrades)
SECRETS_FILE=".env.deploy.secrets"
if [ ! -f "$SECRETS_FILE" ]; then
  say "Generating JWT_SECRET"
  JWT_SECRET=$(openssl rand -hex 32)
  umask 077
  printf 'JWT_SECRET=%s\n' "$JWT_SECRET" > "$SECRETS_FILE"
fi
# shellcheck disable=SC1090
source "$SECRETS_FILE"

# 4. Production overrides: real secrets + bind web on :80
say "Writing docker-compose.override.yml"
cat > docker-compose.override.yml <<EOF
services:
  postgres:
    restart: unless-stopped
  redis:
    restart: unless-stopped
  api:
    environment:
      JWT_SECRET: "${JWT_SECRET}"
      ALLOWED_ORIGINS: "http://${SERVER_HOST}"
    restart: unless-stopped
  web:
    ports: !override
      - "80:80"
    restart: unless-stopped
EOF

# 5. Open port 80 in ufw if active
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  say "Allowing port 80 in ufw"
  ufw allow 80/tcp || true
fi

# 6. Build & start
say "Building and starting containers"
docker compose up -d --build

say "Waiting for services to become healthy"
sleep 8
docker compose ps

say "Smoke tests"
FRONT=$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost/" || echo fail)
API=$(docker compose exec -T api sh -c "curl -sS -o /dev/null -w '%{http_code}' http://localhost:3000/health" || echo fail)
echo "  frontend (http://localhost/)      -> $FRONT (expect 200)"
echo "  api     (container /health)       -> $API (expect 200)"

if [ "$FRONT" = "200" ] && [ "$API" = "200" ]; then
  say "Deploy OK. Open http://${SERVER_HOST}/"
else
  say "Something failed. Recent logs:"
  docker compose logs --tail=80
  exit 1
fi
