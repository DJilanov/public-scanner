import pg, {
  type PoolClient,
  type PoolConfig,
  type QueryConfig,
  type QueryResult,
  type QueryResultRow
} from "pg";

const { Pool } = pg;

export const DEFAULT_DATABASE_URL =
  "postgres://public_scanner:public_scanner@localhost:5432/public_scanner";

export interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string | QueryConfig<unknown[]>,
    values?: readonly unknown[]
  ): Promise<QueryResult<T>>;
}

export interface Transactional extends Queryable {
  connect(): Promise<PoolClient>;
}

export function createDatabasePool(config: PoolConfig = {}): pg.Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    max: 10,
    ...config
  });
}

export async function withTransaction<T>(
  pool: Transactional,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
