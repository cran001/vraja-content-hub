import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import pg from 'pg';
import { runner } from 'node-pg-migrate';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

// Intentionally never loads dotenv or accepts DATABASE_URL. Every invocation owns a new cluster.
const root = resolve('.test-db');
await mkdir(root, { recursive: true });
const runId = randomUUID();
const runDir = join(root, runId);
await mkdir(runDir);
await writeFile(join(runDir, 'DISPOSABLE.json'), JSON.stringify({ runId, purpose: 'hub integration tests' }));
const pgBin = process.env.HUB_TEST_PG_BIN ?? (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/16/bin' : '/usr/lib/postgresql/16/bin');
const bin = name => join(pgBin, name + (process.platform === 'win32' ? '.exe' : ''));
function run(name, args) {
  // A Windows postmaster can inherit pipe handles. Never capture pg_ctl's stdio.
  const result = spawnSync(bin(name), args, { windowsHide: true, encoding: 'utf8',
    stdio: name === 'pg_ctl' ? 'ignore' : 'pipe', timeout: 60000 });
  if (result.status !== 0) throw new Error(`${name} failed: ${result.stderr || result.error?.message || result.stdout}`);
}
const port = await new Promise(resolvePort => {
  const server = net.createServer();
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolvePort(port)); });
});
const data = join(runDir, 'data');
run('initdb', ['-D', data, '-U', 'hub_test', '--auth=trust', '--encoding=UTF8', '--no-locale']);
let started = false;
try {
  run('pg_ctl', ['-D', data, '-l', join(runDir, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  started = true;
  const connectionString = `postgresql://hub_test@127.0.0.1:${port}/postgres`;
  const connection = new pg.Client({ connectionString });
  await connection.connect();
  const identity = (await connection.query('SELECT current_user AS role, current_setting(\'data_directory\') AS directory')).rows[0];
  if (identity.role !== 'hub_test' || await realpath(identity.directory) !== await realpath(data)) throw new Error('Disposable cluster identity mismatch');
  const database = 'hub_test_' + runId.replaceAll('-', '');
  await connection.query(`CREATE DATABASE ${database}`);
  await connection.end();
  const databaseUrl = `postgresql://hub_test@127.0.0.1:${port}/${database}`;
  const migrationOptions={ databaseUrl, dir: resolve('migrations'), direction: 'up', migrationsTable: 'pgmigrations', log: () => {} };
  await runner({ ...migrationOptions,count:11 });
  const legacy=new pg.Client({connectionString:databaseUrl});await legacy.connect();
  await legacy.query("INSERT INTO scriptures(id,title,is_active) VALUES ('migration_active','Migration fixture',true),('migration_hidden','Migration hidden fixture',false)");
  const verse=(await legacy.query("INSERT INTO scripture_verses(scripture_id,chapter,verse,translation) VALUES ('migration_active',1,1,'Synthetic upgrade fixture') RETURNING id")).rows[0].id;
  const selection=(await legacy.query("INSERT INTO daily_verses(verse_id,theme,reflection,locale,display_date,is_active) VALUES ($1,'Trust','Synthetic upgrade fixture reflection.','en','2000-01-01',true) RETURNING id",[verse])).rows[0].id;
  await runner(migrationOptions);
  const migrated=(await legacy.query("SELECT id,is_active,publication_state FROM scriptures WHERE id LIKE 'migration_%' ORDER BY id")).rows;
  assert.deepEqual(migrated,[{id:'migration_active',is_active:true,publication_state:'published'},{id:'migration_hidden',is_active:false,publication_state:'archived'}]);
  assert.equal((await legacy.query('SELECT verse_id FROM daily_verses WHERE id=$1',[selection])).rows[0].verse_id,verse);
  await legacy.end();
  console.log('PASS migration upgrade: existing IDs, daily references and active/inactive visibility preserved.');
  const serve=process.argv.includes('--serve');
  const http=process.argv.includes('--http');
  if(serve||http){
    const browserDb=new pg.Client({connectionString:databaseUrl});await browserDb.connect();
    await browserDb.query("INSERT INTO admins(email,password_hash,role) VALUES ('browser@example.invalid',$1,'super_admin')",[await bcrypt.hash('local-fixture-only',10)]);
    await browserDb.query("INSERT INTO books(title,description) VALUES ('Browser test book','Synthetic fixture, not devotional source content.')");
    await browserDb.end();
    if(serve)console.log('Disposable browser fixture available at http://127.0.0.1:3107');
  }
  const testEnv={...process.env,DATABASE_URL:databaseUrl,
    JWT_SECRET:randomUUID()+randomUUID(),HUB_TEST_DATABASE:database,HUB_TEST_RUN_ID:runId,
    CLOUDINARY_API_KEY:'',CLOUDINARY_API_SECRET:'',CLOUDINARY_CLOUD_NAME:'',NODE_ENV:serve||http?'production':'test'};
  if(http){
    const httpPort=await new Promise(resolvePort=>{const listener=net.createServer();listener.listen(0,'127.0.0.1',()=>{const value=listener.address().port;listener.close(()=>resolvePort(value));});});
    const origin=`http://127.0.0.1:${httpPort}`;
    const server=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','-p',String(httpPort),'-H','127.0.0.1'],{windowsHide:true,stdio:'ignore',env:testEnv});
    let ended=false;server.on('exit',()=>{ended=true;});
    const closed=new Promise(done=>server.on('exit',done));
    try{
      let ready=false;
      for(let attempt=0;attempt<100&&!ended;attempt++){
        try{const response=await fetch(origin+'/api/capabilities');ready=response.ok;}catch{}
        if(ready)break;await new Promise(done=>setTimeout(done,100));
      }
      if(!ready||ended)throw new Error('Disposable production HTTP server failed to start');
      const result=spawnSync(process.execPath,[resolve('scripts/verify-disposable-http.mjs')],{windowsHide:true,stdio:'inherit',env:{...testEnv,HUB_TEST_HTTP_ORIGIN:origin}});
      process.exitCode=result.status??1;
    }finally{if(!ended)server.kill();await closed;}
  }else{
    const args=serve?[resolve('node_modules/next/dist/bin/next'),'start','-p','3107','-H','127.0.0.1']
      :['--import','tsx','--test','--test-concurrency=1',...(process.argv.slice(2).length?process.argv.slice(2):['tests/integration.test.ts'])];
    const result=spawnSync(process.execPath,args,{windowsHide:true,stdio:'inherit',env:testEnv});
    process.exitCode=result.status??1;
  }

} finally {
  const marker = JSON.parse(await readFile(join(runDir, 'DISPOSABLE.json'), 'utf8'));
  if (marker.runId !== runId) throw new Error('Refusing cleanup: marker mismatch');
  if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  // Keep the stopped cluster and log for failure inspection. Never recursively deletes user paths.
  console.log(`Disposable database stopped. Evidence: .test-db/${runId}`);
}
