import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_VERSION = "scrypt-v1";
const PASSWORD_KEY_LENGTH = 64;

export const SESSION_COOKIE_NAME = "public_scanner_session";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;

  return [
    PASSWORD_HASH_VERSION,
    salt.toString("base64url"),
    key.toString("base64url")
  ].join(":");
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [version, saltInput, keyInput] = storedHash.split(":");
  if (version !== PASSWORD_HASH_VERSION || !saltInput || !keyInput) {
    return false;
  }

  const salt = Buffer.from(saltInput, "base64url");
  const expected = Buffer.from(keyInput, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
