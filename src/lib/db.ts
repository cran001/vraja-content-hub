import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, types, type PoolClient } from 'pg';

// PostgreSQL DATE is a calendar day, never a server-local timestamp.
types.setTypeParser(1082, value => value);

export const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis:10000 });
const transaction = new AsyncLocalStorage<PoolClient>();
export const query = (sql: string, values?: unknown[]) =>
  (transaction.getStore() ?? pool).query(sql, values);

/** A handler's queries share a connection and transactional audit identity. */
export async function inTransaction<T>(work: () => Promise<T>, actorId?: string): Promise<T> {
  if (transaction.getStore()) return work();
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    if (actorId) await client.query("SELECT set_config('hub.actor_id', $1, true)", [actorId]);
    const result = await transaction.run(client, work);
    if (result instanceof Response && !result.ok) await client.query('ROLLBACK');
    else await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
