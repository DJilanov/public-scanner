import type { Queryable } from "../client.js";
import {
  DEFAULT_SELECTED_COUNTRY_CODES,
  INTERNATIONAL_SOURCE_IDS,
  normalizeCountryCodes,
  normalizeSourceIds
} from "@public-scanner/domain";
import type {
  AuthRepositoryPort,
  AuthSession,
  AuthSessionRow,
  AuthenticatedUser,
  AuthUser,
  AuthUserInput,
  AuthUserRow,
  UserPreferences,
  UserPreferencesInput,
  UserPreferencesRow
} from "../types.js";

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  locale: "en",
  theme: "light",
  selectedProfileIds: ["software-development", "hardware-supply"],
  selectedCountryCodes: DEFAULT_SELECTED_COUNTRY_CODES,
  includeInternationalSources: false,
  selectedInternationalSourceIds: INTERNATIONAL_SOURCE_IDS
};

export class AuthRepository implements AuthRepositoryPort {
  public constructor(private readonly db: Queryable) {}

  public async findUserByEmail(email: string): Promise<AuthUser | undefined> {
    const result = await this.db.query<AuthUserRow>(
      `
        SELECT id, email, password_hash, role
        FROM users
        WHERE email_normalized = $1
        LIMIT 1
      `,
      [normalizeEmail(email)]
    );

    const row = result.rows[0];
    return row ? mapAuthUserRow(row) : undefined;
  }

  public async upsertUser(input: AuthUserInput): Promise<AuthenticatedUser> {
    const result = await this.db.query<AuthUserRow>(
      `
        INSERT INTO users (
          email,
          email_normalized,
          password_hash,
          role
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email_normalized) DO UPDATE SET
          email = excluded.email,
          password_hash = excluded.password_hash,
          role = excluded.role,
          updated_at = now()
        RETURNING id, email, password_hash, role
      `,
      [input.email.trim(), normalizeEmail(input.email), input.passwordHash, input.role]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to save user");
    }

    return mapAuthenticatedUser(row);
  }

  public async createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<AuthSession> {
    const result = await this.db.query<AuthSessionRow>(
      `
        WITH inserted AS (
          INSERT INTO user_sessions (user_id, token_hash, expires_at)
          VALUES ($1, $2, $3)
          RETURNING user_id, expires_at
        ),
        touched_user AS (
          UPDATE users
          SET last_login_at = now()
          WHERE id = $1
          RETURNING id, email, role
        )
        SELECT
          touched_user.id AS user_id,
          touched_user.email,
          touched_user.role,
          inserted.expires_at
        FROM inserted
        INNER JOIN touched_user ON touched_user.id = inserted.user_id
      `,
      [userId, tokenHash, expiresAt]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to create session");
    }

    return mapAuthSessionRow(row);
  }

  public async findSessionByTokenHash(
    tokenHash: string
  ): Promise<AuthSession | undefined> {
    const result = await this.db.query<AuthSessionRow>(
      `
        UPDATE user_sessions session
        SET last_seen_at = now()
        FROM users
        WHERE session.user_id = users.id
          AND session.token_hash = $1
          AND session.revoked_at IS NULL
          AND session.expires_at > now()
        RETURNING
          users.id AS user_id,
          users.email,
          users.role,
          session.expires_at
      `,
      [tokenHash]
    );

    const row = result.rows[0];
    return row ? mapAuthSessionRow(row) : undefined;
  }

  public async revokeSession(tokenHash: string): Promise<void> {
    await this.db.query(
      `
        UPDATE user_sessions
        SET revoked_at = now()
        WHERE token_hash = $1
          AND revoked_at IS NULL
      `,
      [tokenHash]
    );
  }

  public async pruneExpiredSessions(): Promise<void> {
    await this.db.query(
      `
        DELETE FROM user_sessions
        WHERE expires_at < now() - interval '7 days'
           OR revoked_at < now() - interval '7 days'
      `
    );
  }

  public async getPreferences(userId: string): Promise<UserPreferences> {
    const result = await this.db.query<UserPreferencesRow>(
      `
        WITH inserted AS (
          INSERT INTO user_preferences (user_id)
          VALUES ($1)
          ON CONFLICT (user_id) DO NOTHING
          RETURNING
            locale,
            theme,
            selected_profile_ids,
            selected_country_codes,
            include_international_sources,
            selected_international_source_ids
        )
        SELECT
          locale,
          theme,
          selected_profile_ids,
          selected_country_codes,
          include_international_sources,
          selected_international_source_ids
        FROM inserted
        UNION ALL
        SELECT
          locale,
          theme,
          selected_profile_ids,
          selected_country_codes,
          include_international_sources,
          selected_international_source_ids
        FROM user_preferences
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId]
    );

    const row = result.rows[0];
    return row ? mapUserPreferencesRow(row) : DEFAULT_USER_PREFERENCES;
  }

  public async savePreferences(
    userId: string,
    input: UserPreferencesInput
  ): Promise<UserPreferences> {
    const current = await this.getPreferences(userId);
    const next: UserPreferences = {
      locale: input.locale ?? current.locale,
      theme: input.theme ?? current.theme,
      selectedProfileIds: input.selectedProfileIds ?? current.selectedProfileIds,
      selectedCountryCodes: input.selectedCountryCodes ?? current.selectedCountryCodes,
      includeInternationalSources:
        input.includeInternationalSources ?? current.includeInternationalSources,
      selectedInternationalSourceIds:
        input.selectedInternationalSourceIds ?? current.selectedInternationalSourceIds
    };

    const result = await this.db.query<UserPreferencesRow>(
      `
        INSERT INTO user_preferences (
          user_id,
          locale,
          theme,
          selected_profile_ids,
          selected_country_codes,
          include_international_sources,
          selected_international_source_ids
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
          locale = excluded.locale,
          theme = excluded.theme,
          selected_profile_ids = excluded.selected_profile_ids,
          selected_country_codes = excluded.selected_country_codes,
          include_international_sources = excluded.include_international_sources,
          selected_international_source_ids = excluded.selected_international_source_ids,
          updated_at = now()
        RETURNING
          locale,
          theme,
          selected_profile_ids,
          selected_country_codes,
          include_international_sources,
          selected_international_source_ids
      `,
      [
        userId,
        next.locale,
        next.theme,
        next.selectedProfileIds,
        next.selectedCountryCodes,
        next.includeInternationalSources,
        next.selectedInternationalSourceIds
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to save user preferences");
    }

    return mapUserPreferencesRow(row);
  }
}

function mapAuthUserRow(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role
  };
}

function mapAuthenticatedUser(row: AuthUserRow): AuthenticatedUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role
  };
}

function mapAuthSessionRow(row: AuthSessionRow): AuthSession {
  return {
    user: {
      id: row.user_id,
      email: row.email,
      role: row.role
    },
    expiresAt: normalizeDbDate(row.expires_at)
  };
}

function mapUserPreferencesRow(row: UserPreferencesRow): UserPreferences {
  const selectedInternationalSourceIds = normalizeSourceIds(
    row.selected_international_source_ids
  ).filter((sourceId) => INTERNATIONAL_SOURCE_IDS.includes(sourceId));

  return {
    locale: row.locale,
    theme: row.theme,
    selectedProfileIds: row.selected_profile_ids,
    selectedCountryCodes: normalizeCountryCodes(row.selected_country_codes),
    includeInternationalSources: row.include_international_sources,
    selectedInternationalSourceIds:
      selectedInternationalSourceIds.length > 0
        ? selectedInternationalSourceIds
        : INTERNATIONAL_SOURCE_IDS
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDbDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
