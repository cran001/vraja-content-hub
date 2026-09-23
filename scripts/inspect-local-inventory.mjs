import assert from 'node:assert/strict';
import pg from 'pg';

assert.ok(process.env.DATABASE_URL,'Local database configuration required.');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname),'This read-only inventory is limited to a configured loopback database.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
try{
  await client.connect();await client.query('BEGIN READ ONLY');
  const result={environment:'configured-local-read-only',checkedAt:new Date().toISOString()};
  for(const table of ['daily_verses','scriptures','dated_events','books','categories','wallpapers']){
    const cols=(await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",[table])).rows;
    if(!cols.length){result[table]={tableMissing:true};continue;}
    result[table]=(await client.query(`SELECT count(*)::int AS total${cols.some(c=>c.column_name==='is_active')?',count(*) FILTER(WHERE is_active)::int AS active':''} FROM ${table}`)).rows[0];
  }
  result.scriptureVerses=(await client.query('SELECT count(*)::int AS total FROM scripture_verses')).rows[0];
  result.dailyLocales=(await client.query('SELECT locale,count(*)::int AS total,count(*) FILTER(WHERE is_active)::int AS active,count(*) FILTER(WHERE display_date IS NOT NULL)::int AS scheduled FROM daily_verses GROUP BY locale ORDER BY locale')).rows;
  result.migrations=(await client.query('SELECT name FROM pgmigrations ORDER BY id')).rows.map(row=>row.name);
  await client.query('ROLLBACK');console.log(JSON.stringify(result,null,2));
}catch{console.error('Read-only inventory unavailable; no content was changed.');process.exitCode=1;}
finally{await client.end();}
