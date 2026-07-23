import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { withTransaction, type Queryable, type Transactional } from "./client.js";

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

interface MigrationRow {
  id: string;
}

const migrationDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "migrations"
);

export async function runMigrations(db: Transactional): Promise<MigrationResult> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (await hasMigration(db, file)) {
      skipped.push(file);
      continue;
    }

    const sql = await readFile(join(migrationDirectory, file), "utf8");
    await withTransaction(db, async (client) => {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
    });
    applied.push(file);
  }

  return { applied, skipped };
}

async function hasMigration(db: Queryable, id: string): Promise<boolean> {
  const result = await db.query<MigrationRow>(
    "SELECT id FROM schema_migrations WHERE id = $1",
    [id]
  );

  return result.rowCount === 1;
}
