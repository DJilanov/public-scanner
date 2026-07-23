const cwd = process.env.PUBLIC_SCANNER_HOME || "/opt/public-scanner";

module.exports = {
  apps: [
    {
      name: "public-scanner-api",
      cwd,
      script: "apps/api/dist/server.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        API_HOST: process.env.API_HOST || "127.0.0.1",
        API_PORT: process.env.API_PORT || "3201",
        DATABASE_URL: process.env.DATABASE_URL,
        SESSION_TTL_DAYS: process.env.SESSION_TTL_DAYS || "14"
      }
    },
    {
      name: "public-scanner-worker",
      cwd,
      script: "apps/worker/dist/index.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
        DATABASE_URL: process.env.DATABASE_URL,
        WORKER_MODE: process.env.WORKER_MODE || "scheduler",
        WORKER_INTERVAL_MINUTES: process.env.WORKER_INTERVAL_MINUTES || "360",
        BACKFILL_DAYS: process.env.BACKFILL_DAYS || "3",
        TED_MAX_PAGES: process.env.TED_MAX_PAGES || "20"
      }
    }
  ]
};
