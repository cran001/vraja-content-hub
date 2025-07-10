import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// The comment below tells ESLint to ignore the 'no-explicit-any' rule for the next line only.
// This is the specific fix for the final Vercel deployment error.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const query = (text: string, params?: Array<any>) => pool.query(text, params);