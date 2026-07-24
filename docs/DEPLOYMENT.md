# Deployment

Target server:

```text
root@89.167.46.193
```

Public host:

```text
publicauctions.jilanov.com
```

## Server Requirements

- Ubuntu/Debian server with SSH access.
- Node.js 20 and npm.
- PM2.
- Host PostgreSQL.
- Host Nginx and Certbot.
- Ports 80 and 443 open.
- DNS `A` record for `publicauctions.jilanov.com` pointing to `89.167.46.193`.
- Enough disk for PostgreSQL raw JSON payloads.

## First-Time Server Setup

SSH to the server:

```bash
ssh root@89.167.46.193
```

Install runtime dependencies if they are not present:

```bash
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx
npm install -g pm2
```

## Deploy

From the local repo:

```bash
chmod +x scripts/deploy.sh
SERVER=root@89.167.46.193 REMOTE_DIR=/opt/public-scanner scripts/deploy.sh
```

On first deploy, create the root-only PM2 environment file:

```bash
ssh root@89.167.46.193
cd /opt/public-scanner
cp deploy/production.env.example .env.pm2
chmod 600 .env.pm2
nano .env.pm2
```

Set `DATABASE_URL` to the host PostgreSQL database. `SESSION_TTL_DAYS` controls admin
session lifetime and defaults to 14 days.

Manual paid AI tender intelligence is controlled by `AI_ANALYSIS_ENABLED` and the
`DEEPSEEK_*` variables. Scheduled ingestion uses local scoring only unless
`AI_ANALYSIS_AUTO_ENABLED=true` is set; then `AI_ANALYSIS_MAX_PER_RUN` and
`AI_ANALYSIS_MIN_SCORE` control automatic worker spend. Keep `DEEPSEEK_API_KEY` only in
`.env.pm2`; do not commit it.

Create or rotate an admin account:

```bash
set -a
. /opt/public-scanner/.env.pm2
set +a
ADMIN_EMAIL=toni-website@jilanov.com ADMIN_PASSWORD='replace-this-password' npm run admin:upsert
```

Install the host proxy config and issue HTTPS:

```bash
cp deploy/host-nginx.publicauctions.conf /etc/nginx/sites-available/publicauctions.jilanov.com
ln -sf /etc/nginx/sites-available/publicauctions.jilanov.com /etc/nginx/sites-enabled/publicauctions.jilanov.com
nginx -t
systemctl reload nginx
certbot --nginx -d publicauctions.jilanov.com --redirect
```

The app is served from `apps/web/dist`; API and worker are managed by PM2.

## Operations

Check services:

```bash
pm2 status
```

Check API readiness:

```bash
curl https://publicauctions.jilanov.com/ready
```

Check worker logs:

```bash
pm2 logs public-scanner-worker
```

Run one manual ingestion:

```bash
cd /opt/public-scanner
set -a
. ./.env.pm2
set +a
SOURCE_DATE=2026-07-22 WORKER_MODE=once node apps/worker/dist/index.js
```

Backfill a range:

```bash
cd /opt/public-scanner
set -a
. ./.env.pm2
set +a
SOURCE_DATE_FROM=2026-07-20 SOURCE_DATE_TO=2026-07-22 WORKER_MODE=once node apps/worker/dist/index.js
```

The production worker runs in scheduler mode by default and rechecks the last
`BACKFILL_DAYS` every `WORKER_INTERVAL_MINUTES`.
