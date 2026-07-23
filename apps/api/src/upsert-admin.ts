import { AuthRepository, createDatabasePool } from "@public-scanner/db";

import { hashPassword, isValidEmail, normalizeLoginEmail } from "./auth.js";

const email = normalizeLoginEmail(process.env.ADMIN_EMAIL ?? "");
const password = process.env.ADMIN_PASSWORD ?? "";

if (!isValidEmail(email)) {
  console.error("ADMIN_EMAIL must be a valid email address.");
  process.exitCode = 1;
} else if (password.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exitCode = 1;
} else {
  const pool = createDatabasePool();

  try {
    const repository = new AuthRepository(pool);
    const user = await repository.upsertUser({
      email,
      passwordHash: await hashPassword(password),
      role: "admin"
    });
    console.info(`Admin account saved for ${user.email}`);
  } finally {
    await pool.end();
  }
}
