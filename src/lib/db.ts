import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// The only change is here: any[] is changed to Array<any> to satisfy the linter.
export const query = (text: string, params?: Array<any>) => pool.query(text, params);