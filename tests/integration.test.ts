import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { pool, query } from '../src/lib/db';
import * as imports from '../src/app/api/admin/scripture-verses/route';
import * as protectedRoute from '../src/app/api/admin/test/route';
import * as mediaAdmin from '../src/app/api/admin/wallpapers/route';
import * as categories from '../src/app/api/v1/wallpaper-categories/route';
import * as wallpapers from '../src/app/api/v1/wallpapers/route';
import * as categoryAdmin from '../src/app/api/admin/categories/route';
import { uploadMedia, type AssetGateway } from '../src/lib/mediaUpload';
import { indiaDate, failure } from '../src/lib/api';
import { addDays } from '../src/lib/datedEvents';
import * as daily from '../src/app/api/v1/daily-verse/route';
import * as preview from '../src/app/api/admin/daily-preview/route';
import * as editorial from '../src/app/api/admin/editorial/route';
import * as catalogue from '../src/app/api/v1/scriptures/route';
import * as scriptureBody from '../src/app/api/v1/scriptures/[id]/route';
import * as events from '../src/app/api/v1/events/dated/route';
import { createHash } from 'node:crypto';
import * as storyAdmin from '../src/app/api/admin/stories/route';
import * as storyApi from '../src/app/api/v1/stories/route';
import * as storyDetail from '../src/app/api/v1/stories/[id]/route';
import * as quoteAdmin from '../src/app/api/admin/quotes/route';
import * as quoteApi from '../src/app/api/v1/quotes/selection/route';
import * as contributions from '../src/app/api/admin/contributions/route';
import { assetBatch } from '../src/lib/mediaUpload';
import { readFile,readdir,mkdir,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

import Ajv from 'ajv';
import * as calendarPreview from '../src/app/api/admin/calendar-preview/route';
import * as darshanApi from '../src/app/api/v1/darshan/route';
import * as artApi from '../src/app/api/v1/events/route';
import * as sponsorsApi from '../src/app/api/v1/sponsors/route';
import * as booksApi from '../src/app/api/v1/books/route';
import * as capabilitiesApi from '../src/app/api/capabilities/route';
import * as dailyAdmin from '../src/app/api/admin/daily-verses/route';
const validator=new Ajv({allErrors:true});
const exported: {file:string;schema:string;status:number}[]=[];
async function fixture(name:string,schema:string,payload:unknown,raw?:string,status=200){
  const check=validator.getSchema(`hub#/components/schemas/${schema}`)!;
  assert.ok(check,`Missing schema ${schema}`);
  assert.ok(check(payload),`${name}: ${validator.errorsText(check.errors)}`);
  if(process.env.HUB_EXPORT_FIXTURES==='1'){
    await mkdir(resolve('docs/fixtures'),{recursive:true});
    await writeFile(resolve(`docs/fixtures/${name}.json`),raw??JSON.stringify(payload,null,2)+'\n');
    exported.push({file:`${name}.json`,schema,status});
  }
}

let actor: string;
let restricted: string;
let auth: string;
before(async () => {
  validator.addSchema(JSON.parse(await readFile(resolve('docs/openapi.json'),'utf8')),'hub');
  const db = (await query('SELECT current_database() AS name, current_user AS role')).rows[0];
  assert.equal(db.name, process.env.HUB_TEST_DATABASE);
  assert.match(db.name, /^hub_test_[a-f0-9]{32}$/);
  assert.equal(db.role, 'hub_test');
  assert.ok(process.env.HUB_TEST_RUN_ID);
  actor = (await query("INSERT INTO admins(email,password_hash,role) VALUES ('test@example.invalid','not-a-password','super_admin') RETURNING id")).rows[0].id;
  restricted = (await query("INSERT INTO admins(email,password_hash,role) VALUES ('community@example.invalid','not-a-password','community_admin') RETURNING id")).rows[0].id;
  auth = await token(actor);
  await fixture('categories-empty','CategoryList',await (await categories.GET(request('/api/v1/wallpaper-categories'))).json());
});
after(async()=>{if(exported.length)await writeFile(resolve('docs/fixtures/manifest.json'),JSON.stringify({synthetic:true,description:'Disposable route responses. Never import as devotional content.',items:exported},null,2)+'\n');await pool.end();});
async function token(id: string, expiry = '1h') {
  return new SignJWT({ userId: id }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(expiry)
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
}
function request(path: string, method = 'GET', body?: unknown, bearer: string | null = auth) {
  return new NextRequest(`http://localhost${path}`, { method, headers: {
    ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), 'content-type': 'application/json',
    'x-user-role': 'super_admin', 'x-user-id': actor,
  }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
test('admin identity is resolved from DB and cannot be supplied through headers or a roleless token', async () => {
  assert.equal((await protectedRoute.GET(request('/api/admin/test', 'GET', undefined, null))).status, 401);
  assert.equal((await protectedRoute.GET(request('/api/admin/test', 'GET', undefined, await token(actor, '-1h')))).status, 401);
  assert.equal((await protectedRoute.GET(request('/api/admin/test', 'GET', undefined, await token(restricted)))).status, 403);
  assert.equal((await protectedRoute.GET(request('/api/admin/test'))).status, 200);
  await query("UPDATE admins SET role='unknown' WHERE id=$1", [restricted]);
  assert.equal((await protectedRoute.GET(request('/api/admin/test', 'GET', undefined, await token(restricted)))).status, 403);
});

test('reimport is atomic, preserves reference IDs and daily selections, and increments only changed versions', async () => {
  await query("INSERT INTO scriptures(id,title,has_cantos) VALUES ('test_scripture','Test scripture',false)");
  const verse = { chapter: 1, verse: 1, sanskrit: 'परीक्षण', iast: 'test fixture', translation: 'Test fixture translation.',puranic_story:{title:'Synthetic fixture',a:'Different JSON key order'} };
  const send = (body: object) => imports.POST(request('/api/admin/scripture-verses', 'POST', { scripture_id: 'test_scripture', verses: [verse], ...body }));
  let response = await send({});
  assert.equal(response.status, 200, await response.clone().text());
  const initial = await response.json();
  const row = (await query("SELECT * FROM scripture_verses WHERE scripture_id='test_scripture'")).rows[0];
  const selection = (await query("INSERT INTO daily_verses(verse_id,theme,reflection,locale,display_date,priority) VALUES ($1,'trust','A test reflection about sincere action.','en','2026-09-09',5) RETURNING *", [row.id])).rows[0];
  response = await send({});
  assert.equal((await response.json()).version, initial.version);
  response = await send({ verses: [{ ...verse, translation: 'Corrected fixture translation.' }] });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).version, initial.version + 1);
  assert.equal((await query("SELECT id FROM scripture_verses WHERE scripture_id='test_scripture'")).rows[0].id, row.id);
  assert.deepEqual((await query('SELECT * FROM daily_verses WHERE id=$1', [selection.id])).rows[0], selection);
  const before = (await query("SELECT row_to_json(v) AS data FROM scripture_verses v WHERE scripture_id='test_scripture'")).rows;
  response = await send({ verses: [{ ...verse, chapter: 0 }] });
  assert.equal(response.status, 400);
  assert.deepEqual((await query("SELECT row_to_json(v) AS data FROM scripture_verses v WHERE scripture_id='test_scripture'")).rows, before);
  response = await send({ verses: [{ ...verse, verse: 2 }] });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).details.dependents[0].id, selection.id);
  response = await send({ verses: [{ ...verse, verse: 2 }], removed_resolution: 'retain' });
  assert.equal(response.status, 200);
  assert.equal((await query("SELECT count(*)::int AS count FROM scripture_verses WHERE scripture_id='test_scripture'")).rows[0].count, 2);
  assert.ok((await query("SELECT id FROM content_audit WHERE actor_id=$1 AND entity_type='scripture_verses'", [actor])).rows.length);
});

test('media toggles preserve omitted fields and validate explicit null, booleans and exclusive expiry', async () => {
  const cat = (await query("INSERT INTO categories(name,slug) VALUES ('Media test','media-test') RETURNING id")).rows[0].id;
  const item = (await query(`INSERT INTO wallpapers(name,content_type,is_sponsor,category_id,visible_date,expires_on,public_id,original_url,thumbnail_url,publication_state)
    VALUES ('Sponsor fixture','sponsor',true,$1,'2026-09-09','2026-09-11','test/sponsor','https://example.invalid/image.png','https://example.invalid/thumb.png','published') RETURNING id`,[cat])).rows[0].id;
  const update = (body: object) => mediaAdmin.PUT(request('/api/admin/wallpapers','PUT',{id:item,...body}));
  const response = await update({is_active:false});
  assert.equal(response.status,200,await response.clone().text());
  const saved = (await query("SELECT category_id,to_char(visible_date,'YYYY-MM-DD') AS day,to_char(expires_on,'YYYY-MM-DD') AS expiry FROM wallpapers WHERE id=$1",[item])).rows[0];
  assert.deepEqual(saved,{category_id:cat,day:'2026-09-09',expiry:'2026-09-11'});
  assert.equal((await update({is_sponsor:false,content_type:'wallpaper'})).status,200);
  assert.equal((await update({is_sponsor:true,content_type:'sponsor'})).status,200);
  assert.deepEqual((await query("SELECT category_id,to_char(visible_date,'YYYY-MM-DD') AS day,to_char(expires_on,'YYYY-MM-DD') AS expiry FROM wallpapers WHERE id=$1",[item])).rows[0],saved);
  assert.equal((await update({is_active:'true'})).status,400);
  assert.equal((await update({name:null})).status,400);
  assert.equal((await update({expires_on:'2026-09-09'})).status,400);
  assert.equal((await update({category_id:null,title:null})).status,200);
  assert.equal((await query('SELECT category_id FROM wallpapers WHERE id=$1',[item])).rows[0].category_id,null);
});

test('category tree includes three levels and empty nodes; counts and filters use active subtrees', async () => {
  const root = (await query("INSERT INTO categories(name,slug) VALUES ('Root','root') RETURNING id")).rows[0].id;
  const mid = (await query("INSERT INTO categories(name,slug,parent_id,level) VALUES ('Middle','middle',$1,1) RETURNING id",[root])).rows[0].id;
  const leaf = (await query("INSERT INTO categories(name,slug,parent_id,level) VALUES ('Leaf','leaf',$1,2) RETURNING id",[mid])).rows[0].id;
  const empty = (await query("INSERT INTO categories(name,slug) VALUES ('Empty','empty') RETURNING id")).rows[0].id;
  await query(`INSERT INTO wallpapers(name,category_id,public_id,original_url,thumbnail_url,publication_state,visible_date,expires_on)
    VALUES ('Wallpaper fixture',$1,'test/wallpaper','https://example.invalid/a.png','https://example.invalid/t.png','published','2026-09-09','2026-09-10')`,[leaf]);
  let response = await categories.GET(request('/api/v1/wallpaper-categories?date=2026-09-09'));
  const tree = await response.json();
  await fixture('category-tree','CategoryList',tree);
  for (const id of [root,mid,leaf]) assert.equal(tree.find((c:{id:string})=>c.id===id).active_wallpaper_count,1);
  assert.equal(tree.find((c:{id:string})=>c.id===empty).active_wallpaper_count,0);
  response = await wallpapers.GET(request(`/api/v1/wallpapers?category_id=${root}&date=2026-09-09`));
  await fixture('wallpapers','MediaList',await response.clone().json());
  assert.equal((await response.json()).length,1);
  assert.equal((await (await wallpapers.GET(request('/api/v1/wallpapers?category=root&date=2026-09-09'))).json()).length,1);
  assert.equal((await (await wallpapers.GET(request('/api/v1/wallpapers?category=missing'))).json()).length,0);
  assert.equal((await wallpapers.GET(request('/api/v1/wallpapers?category_id=invalid'))).status,400);
  assert.equal((await wallpapers.GET(request('/api/v1/wallpapers?page=0'))).status,400);
  assert.equal((await (await wallpapers.GET(request('/api/v1/wallpapers?date=2026-09-10'))).json()).length,0);
  await query('UPDATE categories SET is_active=false WHERE id=$1',[mid]);
  const hiddenTree=await (await categories.GET(request('/api/v1/wallpaper-categories?date=2026-09-09'))).json();
  assert.equal(hiddenTree.find((c:{id:string})=>c.id===leaf).is_active,false);
  await fixture('category-inactive-subtree','CategoryList',hiddenTree);
  assert.equal((await (await wallpapers.GET(request('/api/v1/wallpapers?date=2026-09-09'))).json()).length,0);
  const deletion = await categoryAdmin.DELETE(request(`/api/admin/categories?id=${root}&confirm=${root}`,'DELETE'));
  assert.equal(deletion.status,409);
  assert.equal((await deletion.json()).details.categories.length,3);
  assert.equal(indiaDate(new Date('2026-09-09T18:29:59Z')),'2026-09-09');
  assert.equal(indiaDate(new Date('2026-09-09T18:30:00Z')),'2026-09-10');
});

test('upload failures compensate assets and persist cleanup work; retries do not duplicate records', async () => {
  const form = new FormData();
  form.set('name','Upload fixture');
  form.set('image_0',new File([Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0])],'fixture.png',{type:'image/png'}));
  const calls: string[] = [];
  const fake: AssetGateway = {
    async upload(_buffer,_type,publicId) { calls.push(publicId); return {public_id:publicId,original_url:'https://example.invalid/o.png',thumbnail_url:'https://example.invalid/t.png',image_width:1,image_height:1}; },
    async destroy(publicId) { calls.push('destroy:'+publicId); },
  };
  const result = await uploadMedia(form,actor,'test-upload-success',fake);
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].is_active,false);
  await uploadMedia(form,actor,'test-upload-success',fake);
  assert.equal(calls.length,1);
  const broken: AssetGateway = { ...fake, async upload() { throw new Error('simulated lost upload response'); }, async destroy() { throw new Error('simulated cleanup outage'); } };
  await assert.rejects(()=>uploadMedia(form,actor,'test-upload-failed',broken), /Upload batch failed/);
  assert.equal((await query("SELECT state FROM media_uploads WHERE id='test-upload-failed'")).rows[0].state,'cleanup_required');
  assert.equal((await query("SELECT count(*)::int AS count FROM wallpapers WHERE upload_key LIKE 'test-upload-failed%'")).rows[0].count,0);
  assert.equal((await query("SELECT count(*)::int AS count FROM media_cleanup WHERE public_id LIKE '%test-upload-failed%'")).rows[0].count,1);
});

test('review and publication are separate, audited actions; unknown provenance cannot be published',async()=>{
  let row=(await query("SELECT * FROM scriptures WHERE id='test_scripture'")).rows[0];
  const mutate=(body:object)=>editorial.PUT(request('/api/admin/editorial','PUT',{collection:'scriptures',id:row.id,expected_revision:row.revision,...body}));
  assert.equal((await mutate({action:'publish'})).status,422);
  let response=await mutate({action:'review',metadata:{source_name:'Synthetic test source',rights_status:'original',provenance:'Synthetic test fixture; not scripture for publication.',reviewer_notes:'Reviewed synthetic fixture for test only.'}});
  assert.equal(response.status,200,await response.clone().text()); row=await response.json();
  response=await mutate({action:'publish'});
  assert.equal(response.status,200,await response.clone().text()); row=await response.json();
  assert.equal(row.is_active,true);
  const audits=(await query("SELECT action FROM content_audit WHERE entity_type='scriptures' AND entity_id='test_scripture' AND actor_id=$1",[actor])).rows.map(r=>r.action);
  assert.ok(audits.includes('reviewed')); assert.ok(audits.includes('published'));
});

test('catalogue and body hashes agree; correction cannot return an old body for a new version',async()=>{
  let response=await catalogue.GET(request('/api/v1/scriptures'));
  assert.equal(response.status,200,await response.clone().text());
  const first=(await response.json()).find((s:{id:string})=>s.id==='test_scripture');
  response=await scriptureBody.GET(request(first.downloadUrl),{params:Promise.resolve({id:first.id})});
  assert.equal(response.status,200);
  const raw=await response.text();
  await fixture('scripture-catalogue','ScriptureCatalogue',[first]);
  await fixture('scripture-body','VerseList',JSON.parse(raw),raw);
  assert.equal(createHash('sha256').update(raw).digest('hex'),first.contentHash);
  assert.equal(response.headers.get('X-Scripture-Version'),String(first.version));
  const correction=await imports.POST(request('/api/admin/scripture-verses','POST',{scripture_id:first.id,mode:'merge',expected_version:first.version,reviewed_correction:true,
    verses:[{chapter:1,verse:1,translation:'Another corrected synthetic fixture.'}]}));
  assert.equal(correction.status,200,await correction.clone().text());
  assert.equal((await scriptureBody.GET(request(first.downloadUrl),{params:Promise.resolve({id:first.id})})).status,409);
  const second=(await (await catalogue.GET(request('/api/v1/scriptures'))).json()).find((s:{id:string})=>s.id===first.id);
  assert.ok(second.version>first.version); assert.notEqual(second.contentHash,first.contentHash);
  response=await scriptureBody.GET(request(second.downloadUrl),{params:Promise.resolve({id:first.id})});
  assert.match(await response.text(),/Another corrected synthetic fixture/);
  await query("UPDATE scriptures SET is_active=false WHERE id='test_scripture'");
  assert.equal((await scriptureBody.GET(request(second.downloadUrl),{params:Promise.resolve({id:first.id})})).status,404);
});

test('daily selection freezes same-day choices, supports reviewed correction and truthful language fallback',async()=>{
  const day=indiaDate();
  await query("INSERT INTO scriptures(id,title,publication_state) VALUES ('daily_source','Daily fixture source','published')");
  const source=(await query("INSERT INTO scripture_verses(scripture_id,chapter,verse,translation) VALUES ('daily_source',1,1,'Synthetic English fixture') RETURNING id")).rows[0].id;
  const add=async(locale:string,override:string|null,date:string|null)=> (await query(`INSERT INTO daily_verses(verse_id,theme,reflection,locale,translation_override,translation_locale,display_date,publication_state)
    VALUES ($1,'trust',$5,$2::text,$3,$2::text,$4,'published') RETURNING id`,[source,locale,override,date,locale.startsWith('hi')?'यह केवल परीक्षण हेतु हिंदी चिंतन है।':'Synthetic reflection for route tests.'])).rows[0].id;
  const en=await add('en',null,null);
  let result=await (await daily.GET(request(`/api/v1/daily-verse?date=${day}&locale=en`))).json();
  assert.equal(result.id,en); assert.equal(result.frozen,true);
  const scheduled=await add('en','Reviewed correction fixture.',day);
  result=await (await daily.GET(request(`/api/v1/daily-verse?date=${day}&locale=en`))).json();
  assert.equal(result.id,en);
  const corrected=await preview.POST(request('/api/admin/daily-preview','POST',{date:day,locale:'en',id:scheduled,reason:'Reviewed correction of today\'s fixture.'}));
  assert.equal(corrected.status,200,await corrected.clone().text());
  result=await (await daily.GET(request(`/api/v1/daily-verse?date=${day}&locale=en`))).json();
  assert.equal(result.id,scheduled); assert.equal(result.assignmentRevision,2);
  await fixture('daily-en-scheduled-correction','DailyVerse',result);
  const hi=await add('hi','परीक्षण के लिए हिंदी पाठ।',null);
  result=await (await daily.GET(request(`/api/v1/daily-verse?date=${day}&locale=hi-IN`))).json();
  await fixture('daily-hi-regional-fallback','DailyVerse',result);
  assert.equal(result.id,hi); assert.equal(result.locale,'hi'); assert.equal(result.translationLocale,'hi'); assert.match(result.reflection,/[\u0900-\u097F]/); assert.equal(result.languageFallback,true);
  result=await (await daily.GET(request(`/api/v1/daily-verse?date=${day}&locale=mr`))).json();
  assert.equal(result.locale,'en'); assert.equal(result.languageFallback,true);
  await fixture('daily-mr-english-fallback','DailyVerse',result);
  await query("UPDATE daily_verses SET is_active=false WHERE id=$1",[scheduled]);
  result=await (await daily.GET(request(`/api/v1/daily-verse?date=${day}&locale=en`))).json();
  assert.equal(result.id,en); assert.equal(result.assignmentRevision,3);
  const nextDay=await (await daily.GET(request(`/api/v1/daily-verse?date=${addDays(day,1)}&locale=en`))).json();
  assert.equal(nextDay.id,en);assert.equal(nextDay.date,addDays(day,1));assert.equal(nextDay.frozen,false);
  await query("UPDATE scriptures SET is_active=false WHERE id='daily_source'");
  assert.equal((await daily.GET(request(`/api/v1/daily-verse?date=${day}&locale=en`))).status,404);
});

test('dated events preserve windows and after semantics only for the explicitly matching location and timezone',async()=>{
  await query(`INSERT INTO dated_events(title,event_type,event_date,description,parana_date,parana_start_time,parana_end_time,parana_type,timing_location,timing_timezone,timing_source,publication_state)
    VALUES ('Test fast','Ekadashi','2026-09-09','Synthetic event fixture','2026-09-10','06:30','10:30','window','in-mumbai','Asia/Kolkata','Synthetic timing fixture','published'),
    ('Test after','Ekadashi','2026-09-09','Synthetic event fixture','2026-09-10','10:50',null,'after','in-mumbai','Asia/Kolkata','Synthetic timing fixture','published')`);
  const base='/api/v1/events/dated?from=2026-09-09&to=2026-09-09';
  let response=await events.GET(request(base));
  let items=await response.json();
  await fixture('events-timing-withheld','DatedEventList',items);
  assert.equal(items.length,2); assert.ok(items.every((e:{timingWithheld:boolean})=>e.timingWithheld));
  assert.ok(items.every((e:{paranaStartTime?:string})=>!e.paranaStartTime));
  items=await (await events.GET(request(base+'&location=in-delhi&timezone=Asia/Kolkata'))).json();
  assert.ok(items.every((e:{timingWithheld:boolean})=>e.timingWithheld));
  response=await events.GET(request(base+'&location=in-mumbai&timezone=Asia/Kolkata'));
  items=await response.json();
  await fixture('events-parana-window-and-after','DatedEventList',items);
  assert.equal(items.find((e:{title:string})=>e.title==='Test after').paranaType,'after');
  assert.equal(items.find((e:{title:string})=>e.title==='Test fast').paranaEndTime,'10:30');
  assert.equal((await events.GET(request('/api/v1/events/dated?from=2026-02-30'))).status,400);
  await query("UPDATE dated_events SET cancelled=true WHERE title='Test after'");
  assert.equal((await (await events.GET(request(base))).json()).length,1);
});

test('all admin handlers enforce authentication even when called without middleware',async()=>{
  for(const entry of await readdir(resolve('src/app/api/admin'),{withFileTypes:true})){
    if(!entry.isDirectory())continue;
    const path=resolve('src/app/api/admin',entry.name,'route.ts');
    const source=await readFile(path,'utf8');
    assert.match(source,/withAdmin/);
    const routes=await import(pathToFileURL(path).href);
    for(const method of ['GET','POST','PUT','DELETE'])if(routes[method]){
      const response=await routes[method](request(`/api/admin/${entry.name}`,method,method==='POST'||method==='PUT'?{}:undefined,null));
      assert.equal(response.status,401,`${entry.name} ${method}`);
    }
  }
});

test('community accounts can draft only their own contributions, never publish or delete shared content',async()=>{
  await query("UPDATE admins SET role='community_admin' WHERE id=$1",[restricted]);
  const bearer=await token(restricted);
  const own=await contributions.POST(request('/api/admin/contributions','POST',{content_type:'verse',title:'Own draft',body:'Synthetic draft for editorial review.',locale:'en',publication_state:'published'},bearer));
  assert.equal(own.status,201);const item=await own.json();assert.equal(item.state,'draft');
  const another=(await query("INSERT INTO editorial_contributions(author_id,content_type,title,body,locale) VALUES ($1,'verse','Other draft','Synthetic draft owned by the editor.','en') RETURNING id",[actor])).rows[0].id;
  assert.equal((await contributions.POST(request('/api/admin/contributions','POST',{id:another,content_type:'verse',title:'Attempted edit',body:'Unauthorized fixture edit attempt.',locale:'en'},bearer))).status,403);
  assert.equal((await editorial.PUT(request('/api/admin/editorial','PUT',{action:'publish'},bearer))).status,403);
  assert.equal((await mediaAdmin.DELETE(request('/api/admin/wallpapers','DELETE',undefined,bearer))).status,403);
  const visible=await (await contributions.GET(request('/api/admin/contributions','GET',undefined,bearer))).json();
  assert.ok(visible.items.every((r:{author_id:string})=>r.author_id===restricted));
});

test('concurrent scripture imports cannot overwrite the same expected version and retain canto identity',async()=>{
  await query("INSERT INTO scriptures(id,title,has_cantos) VALUES ('concurrency_fixture','Concurrent fixture',true)");
  const send=(translation:string)=>imports.POST(request('/api/admin/scripture-verses','POST',{scripture_id:'concurrency_fixture',expected_version:1,
    verses:[{canto:1,chapter:1,verse:1,translation},{canto:2,chapter:1,verse:1,translation:'Second canto fixture'}]}));
  const responses=await Promise.all([send('Correction A'),send('Correction B')]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const rows=(await query("SELECT id,canto,chapter,verse FROM scripture_verses WHERE scripture_id='concurrency_fixture' ORDER BY canto")).rows;
  assert.equal(rows.length,2);assert.notEqual(rows[0].id,rows[1].id);assert.deepEqual(rows.map(r=>r.canto),[1,2]);
});

test('asset save failures roll back records and compensate completed uploads',async()=>{
  const file=new File([Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0])],'fixture.png',{type:'image/png'});
  const destroyed:string[]=[];
  const fake:AssetGateway={async upload(_b,_t,id){return {public_id:id,original_url:'https://example.invalid/cover.png',thumbnail_url:'https://example.invalid/thumb.png',image_width:1,image_height:1};},async destroy(id){destroyed.push(id);}};
  await assert.rejects(()=>assetBatch([file],{fixture:'db-failure'},actor,'test-book-failure',async()=>{
    await query("INSERT INTO books(title) VALUES ('Should roll back')");
    throw new Error('Simulated database save failure');
  },fake));
  assert.equal((await query("SELECT count(*)::int AS count FROM books WHERE title='Should roll back'")).rows[0].count,0);
  assert.equal(destroyed.length,1);
});

test('stories reuse book identity, paginate consistently, preserve language truth and report withdrawal',async()=>{
  const row=(await query("INSERT INTO books(title,cover_url) VALUES ('Synthetic story fixture','https://example.invalid/cover.png') RETURNING *")).rows[0];
  let response=await storyAdmin.PUT(request('/api/admin/stories','PUT',{id:row.id,expected_revision:row.revision,is_story:true,summary:'Synthetic summary.',story_body:'Synthetic story text for the route contract test.',themes:['Trust'],deities:['Krishna'],scripture_references:['Synthetic source reference; not a real scripture'],published_on:indiaDate()}));
  assert.equal(response.status,200,await response.clone().text());let book=await response.json();
  response=await editorial.PUT(request('/api/admin/editorial','PUT',{collection:'books',id:book.id,expected_revision:book.revision,action:'review',metadata:{source_name:'Test fixture',rights_status:'original',provenance:'Synthetic content solely for testing.',reviewer_notes:'Reviewed for route contract testing only.'}}));
  assert.equal(response.status,200,await response.clone().text());book=await response.json();
  response=await editorial.PUT(request('/api/admin/editorial','PUT',{collection:'books',id:book.id,expected_revision:book.revision,action:'publish'}));
  assert.equal(response.status,200,await response.clone().text());
  const feed=await (await storyApi.GET(request('/api/v1/stories?locale=hi-IN&limit=1'))).json();
  await fixture('story-feed-english-fallback','StoryFeed',feed);
  assert.equal(feed.items[0].id,book.id);assert.equal(feed.items[0].bookId,book.id);assert.equal(feed.items[0].locale,'en');assert.equal(feed.items[0].languageFallback,true);
  const detail=await (await storyDetail.GET(request(`/api/v1/stories/${book.id}`),{params:Promise.resolve({id:book.id})})).json();
  await fixture('story-detail','StoryDetail',detail);
  assert.match(detail.body,/Synthetic story text/);assert.ok(Array.isArray(detail.pages));
  await query('UPDATE books SET published_on=$2 WHERE id=$1',[book.id,addDays(indiaDate(),1)]);
  assert.equal((await booksApi.GET(request(`/api/v1/books?id=${book.id}`))).status,404);
  await query('UPDATE books SET published_on=$2 WHERE id=$1',[book.id,indiaDate()]);
  assert.equal((await storyApi.GET(request('/api/v1/stories?page=2'))).status,409);
  await query('UPDATE books SET is_active=false WHERE id=$1',[book.id]);
  assert.equal((await storyApi.GET(request(`/api/v1/stories?page=2&locale=hi-IN&limit=1&snapshot=${encodeURIComponent(feed.snapshot)}`))).status,409);
  assert.equal((await storyDetail.GET(request(`/api/v1/stories/${book.id}`),{params:Promise.resolve({id:book.id})})).status,404);
  assert.deepEqual((await (await storyApi.GET(request('/api/v1/stories'))).json()).items,[]);
});

test('quotes distinguish original reflection from scripture and respect eligible language fallback',async()=>{
  let response=await quoteAdmin.POST(request('/api/admin/quotes','POST',{kind:'original_reflection',text:'A synthetic original reflection used only in tests.',locale:'en',attribution:'Test writer',theme:'Trust'}));
  assert.equal(response.status,201,await response.clone().text());let quote=await response.json();
  response=await editorial.PUT(request('/api/admin/editorial','PUT',{collection:'quotes',id:quote.id,expected_revision:quote.revision,action:'review',metadata:{source_name:'Test writer',provenance:'Synthetic original text.',rights_status:'original',reviewer_notes:'Reviewed solely for route tests.'}}));
  assert.equal(response.status,200,await response.clone().text());quote=await response.json();
  response=await editorial.PUT(request('/api/admin/editorial','PUT',{collection:'quotes',id:quote.id,expected_revision:quote.revision,action:'publish'}));
  assert.equal(response.status,200,await response.clone().text());
  const payload=await (await quoteApi.GET(request('/api/v1/quotes/selection?locale=hi-IN'))).json();
  await fixture('quote-fallback','Quote',payload);
  assert.equal(payload.kind,'original_reflection');assert.equal(payload.locale,'en');assert.equal(payload.visibilityPolicy,'android-user-setting');
  await query('UPDATE quotes SET lock_screen_eligible=false WHERE id=$1',[quote.id]);
  assert.equal((await quoteApi.GET(request('/api/v1/quotes/selection'))).status,404);
});


test('calendar preview uses public scope and all published response shapes validate against the machine contract',async()=>{
  const route='/api/admin/calendar-preview?from=2026-09-09&to=2026-09-11&location=in-mumbai&timezone=Asia/Kolkata&locale=hi';
  const result=await (await calendarPreview.GET(request(route))).json();
  assert.equal(result.coverage.length,3);
  assert.equal(result.coverage[0].count,1);
  assert.equal(result.coverage[1].withoutPublishedEvent,true);
  assert.deepEqual(result.items,await (await events.GET(request(route.replace('/api/admin/calendar-preview','/api/v1/events/dated')))).json());
  assert.equal((await calendarPreview.GET(request('/api/admin/calendar-preview?from=2026-02-30'))).status,400);
  await fixture('darshan-empty','MediaEnvelope',await (await darshanApi.GET(request('/api/v1/darshan?date=2000-01-01'))).json());
  await fixture('festival-art-empty','MediaEnvelope',await (await artApi.GET(request('/api/v1/events?date=2000-01-01'))).json());
  await fixture('sponsors-empty','MediaList',await (await sponsorsApi.GET(request('/api/v1/sponsors?date=2000-01-01'))).json());
  await fixture('books-empty','BookList',await (await booksApi.GET(request('/api/v1/books'))).json());
  await fixture('stories-empty','StoryFeed',await (await storyApi.GET(request('/api/v1/stories'))).json());
  await fixture('capabilities','Capabilities',await (await capabilitiesApi.GET()).json());
  const invalid=await wallpapers.GET(request('/api/v1/wallpapers?page=0'));
  await fixture('invalid-request','Error',await invalid.json(),undefined,400);
  const missing=await quoteApi.GET(request('/api/v1/quotes/selection'));
  await fixture('quote-unavailable','Error',await missing.json(),undefined,404);
  const id='concurrency_fixture';
  await query("UPDATE scriptures SET publication_state='review' WHERE id=$1",[id]);
  await query("UPDATE scriptures SET publication_state='published' WHERE id=$1",[id]);
  const body=await scriptureBody.GET(request(`/api/v1/scriptures/${id}`),{params:Promise.resolve({id})});
  const text=await body.text();
  await fixture('scripture-two-cantos','VerseList',JSON.parse(text),text);
  const c=(await (await catalogue.GET(request('/api/v1/scriptures'))).json()).filter((row:{id:string})=>row.id===id);
  await fixture('scripture-two-cantos-catalogue','ScriptureCatalogue',c);
});

test('Hindi draft records keep declared translation language and page edits invalidate book review',async()=>{
  const source=(await query("SELECT id FROM scripture_verses WHERE scripture_id='concurrency_fixture' AND canto=1")).rows[0].id;
  const response=await dailyAdmin.POST(request('/api/admin/daily-verses','POST',{scriptureId:'concurrency_fixture',canto:1,chapter:1,verse:1,theme:'Trust',reflection:'यह केवल परीक्षण हेतु हिंदी चिंतन है।',translationOverride:'केवल परीक्षण का पाठ।',translationLocale:'hi',locale:'hi-IN'}));
  assert.equal(response.status,201,await response.clone().text());
  const row=(await query('SELECT * FROM daily_verses WHERE id=$1',[(await response.json()).id])).rows[0];
  assert.equal(row.translation_locale,'hi');assert.equal(row.locale,'hi-IN');assert.equal(row.verse_id,source);assert.equal(row.publication_state,'draft');
  const book=(await query("INSERT INTO books(title,publication_state) VALUES ('Review invalidation fixture','review') RETURNING id")).rows[0].id;
  await query("INSERT INTO book_pages(book_id,page_number,title,public_id,image_url,thumbnail_url) VALUES ($1,1,'Fixture','fixture-review','https://example.invalid/a.png','https://example.invalid/t.png')",[book]);
  assert.equal((await query('SELECT publication_state FROM books WHERE id=$1',[book])).rows[0].publication_state,'draft');
});

test('a failed second image leaves no partial media batch and errors remain distinct from empty success',async()=>{
  const form=new FormData();form.set('name','Partial batch fixture');
  for(let i=0;i<2;i++)form.set(`image_${i}`,new File([Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0])],`fixture${i}.png`,{type:'image/png'}));
  let uploads=0;const destroyed:string[]=[];
  const gateway:AssetGateway={async upload(_b,_t,id){if(++uploads===2)throw new Error('Second fixture upload failed');return {public_id:id,original_url:'https://example.invalid/a.png',thumbnail_url:'https://example.invalid/t.png',image_width:1,image_height:1};},async destroy(id){destroyed.push(id);}};
  await assert.rejects(()=>uploadMedia(form,actor,'test-partial-batch',gateway));
  assert.equal(destroyed.length,2);
  assert.equal((await query("SELECT count(*)::int AS count FROM wallpapers WHERE upload_key LIKE 'test-partial-batch:%'")).rows[0].count,0);
  const serverError=failure(new Error('Synthetic internal failure'));
  assert.equal(serverError.status,500);await fixture('server-failure','Error',await serverError.json(),undefined,500);
  const stale=await storyApi.GET(request('/api/v1/stories?page=2&snapshot=outdated'));
  assert.equal(stale.status,409);await fixture('stale-snapshot','Error',await stale.json(),undefined,409);
});
