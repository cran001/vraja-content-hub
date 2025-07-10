import { Pool } from 'pg';

// This creates a new connection pool. A pool is much more efficient than creating a new
// connection for every single database query.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// We create a very simple query function that uses a connection from the pool,
// sends a query, and then releases the connection back to the pool.
export const query = (text: string, params?: any[]) => pool.query(text, params);