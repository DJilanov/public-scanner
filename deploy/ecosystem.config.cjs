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
        TED_COUNTRY_CODES:
          process.env.TED_COUNTRY_CODES ||
          "BG,RO,GR,HR,SI,ME,AT,BE,DE,DK,ES,FI,FR,IE,IT,LU,NL,PT,SE",
        TED_MAX_PAGES: process.env.TED_MAX_PAGES || "20",
        INCLUDE_SEDIA: process.env.INCLUDE_SEDIA || "true",
        SEDIA_SEARCH_TERMS:
          process.env.SEDIA_SEARCH_TERMS ||
          "software,hardware,cybersecurity,cloud,network,data,digital,IT services",
        SEDIA_PAGE_SIZE: process.env.SEDIA_PAGE_SIZE || "50",
        SEDIA_MAX_PAGES: process.env.SEDIA_MAX_PAGES || "3",
        AI_ANALYSIS_ENABLED:
          process.env.AI_ANALYSIS_ENABLED ||
          (process.env.DEEPSEEK_API_KEY ? "true" : "false"),
        AI_ANALYSIS_MAX_PER_RUN: process.env.AI_ANALYSIS_MAX_PER_RUN || "25",
        AI_ANALYSIS_MIN_SCORE: process.env.AI_ANALYSIS_MIN_SCORE || "62",
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
        DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
        DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
        DEEPSEEK_MAX_TOKENS: process.env.DEEPSEEK_MAX_TOKENS || "1800"
      }
    }
  ]
};
