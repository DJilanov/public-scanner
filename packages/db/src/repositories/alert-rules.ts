import type { AlertRule } from "@public-scanner/domain";

import type { Queryable } from "../client.js";
import type { AlertRuleInput, AlertRuleRepositoryPort, AlertRuleRow } from "../types.js";

export class AlertRuleRepository implements AlertRuleRepositoryPort {
  public constructor(private readonly db: Queryable) {}

  public async listRules(): Promise<AlertRule[]> {
    const result = await this.db.query<AlertRuleRow>(
      `
        SELECT
          id,
          name,
          profile_id,
          min_score,
          watched_buyer,
          cpv_prefix,
          deadline_days,
          channel,
          target,
          enabled,
          created_at,
          updated_at
        FROM alert_rules
        WHERE user_key = 'default'
        ORDER BY enabled DESC, min_score DESC, created_at DESC
      `
    );

    return result.rows.map(mapAlertRuleRow);
  }

  public async upsertRule(input: AlertRuleInput, id?: string): Promise<AlertRule> {
    const result = await this.db.query<AlertRuleRow>(
      `
        INSERT INTO alert_rules (
          id,
          user_key,
          name,
          profile_id,
          min_score,
          watched_buyer,
          cpv_prefix,
          deadline_days,
          channel,
          target,
          enabled
        )
        VALUES (
          coalesce($1::uuid, gen_random_uuid()),
          'default',
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10
        )
        ON CONFLICT (id) DO UPDATE SET
          name = excluded.name,
          profile_id = excluded.profile_id,
          min_score = excluded.min_score,
          watched_buyer = excluded.watched_buyer,
          cpv_prefix = excluded.cpv_prefix,
          deadline_days = excluded.deadline_days,
          channel = excluded.channel,
          target = excluded.target,
          enabled = excluded.enabled,
          updated_at = now()
        RETURNING
          id,
          name,
          profile_id,
          min_score,
          watched_buyer,
          cpv_prefix,
          deadline_days,
          channel,
          target,
          enabled,
          created_at,
          updated_at
      `,
      [
        id ?? null,
        input.name,
        input.profileId ?? null,
        input.minScore,
        input.watchedBuyer ?? null,
        input.cpvPrefix ?? null,
        input.deadlineDays ?? null,
        input.channel,
        input.target ?? null,
        input.enabled
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to save alert rule");
    }

    return mapAlertRuleRow(row);
  }
}

function mapAlertRuleRow(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    name: row.name,
    minScore: row.min_score,
    channel: row.channel,
    enabled: row.enabled,
    ...(row.profile_id !== null ? { profileId: row.profile_id } : {}),
    ...(row.watched_buyer !== null ? { watchedBuyer: row.watched_buyer } : {}),
    ...(row.cpv_prefix !== null ? { cpvPrefix: row.cpv_prefix } : {}),
    ...(row.deadline_days !== null ? { deadlineDays: row.deadline_days } : {}),
    ...(row.target !== null ? { target: row.target } : {}),
    ...(row.created_at ? { createdAt: normalizeDbDate(row.created_at) } : {}),
    ...(row.updated_at ? { updatedAt: normalizeDbDate(row.updated_at) } : {})
  };
}

function normalizeDbDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
