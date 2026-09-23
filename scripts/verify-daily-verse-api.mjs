import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import jwt from 'jsonwebtoken';

// Local integration check. It creates one uniquely named test scripture and removes
// that fixture (and only its dependent rows) in finally. Never use a hosted database.
const origin = process.env.DAILY_VERSE_TEST_ORIGIN || 'http://localhost:3216';
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
assert(localHosts.has(new URL(origin).hostname), 'The API must be local.');
assert(localHosts.has(new URL(process.env.DATABASE_URL).hostname), 'The database must be local.');
assert(process.env.JWT_SECRET, 'JWT_SECRET is required.');
const database = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
const scriptureId = `daily_verse_test_${randomUUID().replaceAll('-', '')}`;
const token = jwt.sign({ role: 'super_admin' }, process.env.JWT_SECRET, { expiresIn: '10m' });
const date = '2099-10-10';
let checks = 0;

async function request(path, { method = 'GET', body, auth = true, status = 200 } = {}) {
  const response = await fetch(`${origin}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(payload)}`);
  checks += 1;
  return payload;
}

await database.connect();
try {
  await database.query('INSERT INTO scriptures (id, title, ref_prefix) VALUES ($1, $2, $3)',
    [scriptureId, 'Daily verse integration fixture', 'TEST']);
  await database.query(`INSERT INTO scripture_verses (scripture_id, chapter, verse, sanskrit, translation)
    VALUES ($1,1,1,'शान्तिः','Peace through sincere practice.'),
           ($1,1,2,'भक्तिः','Remember Bhagwan with devotion.')`, [scriptureId]);

  await request('/api/admin/daily-verses', { auth: false, status: 401 });
  await request('/api/v1/daily-verse?date=2099-02-30', { auth: false, status: 400 });
  const selection = {
    scriptureId, chapter: 1, verse: 1, theme: 'Trust', locale: 'zz',
    reflection: 'Do the work sincerely and entrust its outcome to Bhagwan.',
  };
  await request('/api/admin/daily-verses', { method: 'POST', body: { ...selection, verse: 999 }, status: 422 });
  const rotation = await request('/api/admin/daily-verses', { method: 'POST', body: selection, status: 201 });
  const publicUrl = `/api/v1/daily-verse?date=${date}&locale=zz-ZZ`;
  const first = await request(publicUrl, { auth: false });
  const repeated = await request(publicUrl, { auth: false });
  assert.equal(first.id, rotation.id);
  assert.equal(repeated.id, first.id);
  assert.equal(first.reference, 'TEST 1.1');
  assert.equal(first.locale, 'zz');
  assert.equal(first.date, date);

  const scheduledBody = {
    ...selection, verse: 2, theme: 'Bhakti', displayDate: date,
    translationOverride: 'An original test rendering of the selected verse.',
  };
  const scheduled = await request('/api/admin/daily-verses', { method: 'POST', body: scheduledBody, status: 201 });
  const daily = await request(publicUrl, { auth: false });
  assert.equal(daily.id, scheduled.id);
  assert.equal(daily.scheduled, true);
  assert.equal(daily.reference, 'TEST 1.2');
  assert.equal(daily.translation, scheduledBody.translationOverride);
  await request('/api/admin/daily-verses', { method: 'POST', body: scheduledBody, status: 409 });

  const reflection = 'Let devotion shape the care you bring to ordinary responsibilities.';
  await request('/api/admin/daily-verses', {
    method: 'PUT', body: { ...scheduledBody, id: scheduled.id, reflection },
  });
  assert.equal((await request(publicUrl, { auth: false })).reflection, reflection);
  await request('/api/admin/daily-verses', { method: 'PUT', body: { id: scheduled.id, is_active: false } });
  assert.equal((await request(publicUrl, { auth: false })).id, rotation.id);
  await request(`/api/admin/daily-verses?id=${scheduled.id}`, { method: 'DELETE' });
  const list = await request('/api/admin/daily-verses');
  assert(!list.items.some(item => item.id === scheduled.id));
  assert(list.items.some(item => item.id === rotation.id));
  console.log(`PASS: ${checks} API checks plus source, scheduling, locale fallback, update and visibility assertions.`);
} finally {
  await database.query('DELETE FROM scriptures WHERE id = $1', [scriptureId]);
  await database.end();
  console.log('Temporary integration fixture removed.');
}
