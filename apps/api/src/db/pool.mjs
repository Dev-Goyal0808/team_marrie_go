import pg from 'pg';

const { Pool } = pg;

export class DatabaseUnavailableError extends Error {
  constructor(message = 'The database is not configured or unavailable.') {
    super(message);
    this.name = 'DatabaseUnavailableError';
    this.code = 'DATABASE_UNAVAILABLE';
  }
}

export function databaseConnectionString(env = process.env) {
  return env.DATABASE_URL ?? env.TEST_DATABASE_URL ?? null;
}

export function createDatabasePool({ connectionString = databaseConnectionString(), max = 10 } = {}) {
  if (!connectionString) return null;
  return new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 3_000,
    application_name: 'accessmap-api'
  });
}

export async function withDatabase(pool, callback) {
  if (!pool) throw new DatabaseUnavailableError();
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function withTransaction(pool, callback) {
  return withDatabase(pool, async (client) => {
    await client.query('BEGIN');
    try {
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function setDatabaseContext(client, { userId = null, role = 'anonymous' } = {}) {
  await client.query("SELECT set_config('app.user_id', $1, true), set_config('app.role', $2, true)", [
    userId ?? '',
    role
  ]);
}

export async function closeDatabasePool(pool) {
  if (pool) await pool.end();
}
