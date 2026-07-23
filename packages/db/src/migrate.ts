import { createDatabasePool, runMigrations } from "./index.js";

const pool = createDatabasePool();

try {
  const result = await runMigrations(pool);
  console.info(JSON.stringify(result, null, 2));
} finally {
  await pool.end();
}
