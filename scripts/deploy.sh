#!/usr/bin/env sh
set -eu

SERVER="${SERVER:-root@89.167.46.193}"
REMOTE_DIR="${REMOTE_DIR:-/opt/public-scanner}"

ssh "$SERVER" "mkdir -p '$REMOTE_DIR'"

rsync -az --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "dist" \
  --exclude ".env" \
  --exclude ".env.pm2" \
  ./ "$SERVER:$REMOTE_DIR/"

ssh "$SERVER" "cd '$REMOTE_DIR' && test -f .env.pm2 || { echo 'Missing $REMOTE_DIR/.env.pm2' >&2; exit 1; }"
ssh "$SERVER" "cd '$REMOTE_DIR' && npm ci && npm run build"
ssh "$SERVER" "cd '$REMOTE_DIR' && set -a && . ./.env.pm2 && set +a && npm run db:migrate"
ssh "$SERVER" "cd '$REMOTE_DIR' && install -m 0644 deploy/host-nginx.publicauctions.conf /etc/nginx/sites-available/publicauctions.jilanov.com && ln -sf /etc/nginx/sites-available/publicauctions.jilanov.com /etc/nginx/sites-enabled/publicauctions.jilanov.com && nginx -t && systemctl reload nginx"
ssh "$SERVER" "cd '$REMOTE_DIR' && set -a && . ./.env.pm2 && set +a && pm2 startOrReload deploy/ecosystem.config.cjs --update-env && pm2 save && pm2 startup systemd -u root --hp /root >/dev/null"
ssh "$SERVER" "pm2 status"
