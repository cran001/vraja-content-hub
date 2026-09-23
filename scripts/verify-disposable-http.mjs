import assert from 'node:assert/strict';

// Run only with the verified disposable --serve harness. No configurable remote origin.
assert.match(process.env.HUB_TEST_DATABASE??'',/^hub_test_[a-f0-9]{32}$/);
assert.ok(process.env.HUB_TEST_RUN_ID,'Use the verified --http harness');
const origin=process.env.HUB_TEST_HTTP_ORIGIN;
assert.ok(origin&&/^http:\/\/127\.0\.0\.1:\d+$/.test(origin));
const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email:'browser@example.invalid',password:'local-fixture-only'})});
assert.equal(login.status,200);
const session=await login.json();assert.equal(session.user.role,'super_admin');
const headers={Authorization:`Bearer ${session.token}`,'Content-Type':'application/json'};
const me=await fetch(origin+'/api/admin/me',{headers});assert.equal(me.status,200);
assert.equal((await me.json()).role,'super_admin');
const ready=await fetch(origin+'/api/admin/readiness',{headers});assert.equal(ready.status,200);
assert.equal((await ready.json()).schemaReady,true);
const missing=await fetch(origin+'/api/admin/editorial?collection=quotes');assert.equal(missing.status,401);
const draft=await fetch(origin+'/api/admin/quotes',{method:'POST',headers,body:JSON.stringify({kind:'original_reflection',text:'Synthetic HTTP test reflection; never devotional publication.',locale:'en',attribution:'Test fixture',theme:'Trust'})});
assert.equal(draft.status,201);assert.equal((await draft.json()).publication_state,'draft');
const preview=await fetch(origin+'/api/admin/calendar-preview?from=2026-09-09&to=2026-09-10',{headers});
assert.equal(preview.status,200);assert.equal((await preview.json()).coverage.length,2);
const invalidImage=new FormData();invalidImage.set('name','Invalid image fixture');
invalidImage.set('image_0',new File([],'empty.png',{type:'image/png'}));
const multipart=await fetch(origin+'/api/admin/wallpapers',{method:'POST',headers:{Authorization:headers.Authorization,'Idempotency-Key':'http-invalid-image'},body:invalidImage});
assert.equal(multipart.status,400); // Reject before contacting the asset service.
console.log('PASS production-server HTTP login, trusted identity, readiness, unauthenticated rejection, draft creation, calendar preview and multipart validation. Disposable data only.');
