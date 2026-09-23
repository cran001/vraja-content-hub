import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import Ajv from 'ajv';

const read=name=>readFile(new URL('../docs/'+name,import.meta.url),'utf8');
const contract=JSON.parse(await read('openapi.json'));
const manifest=JSON.parse(await read('fixtures/manifest.json'));
assert.equal(contract.openapi,'3.1.0');
assert.equal(manifest.synthetic,true);
const validator=new Ajv({allErrors:true});
validator.addSchema(contract,'hub');
for(const item of manifest.items){
  const check=validator.getSchema(`hub#/components/schemas/${item.schema}`);
  assert.ok(check,`Missing schema ${item.schema}`);
  const data=JSON.parse(await read('fixtures/'+item.file));
  assert.ok(check(data),`${item.file}: ${validator.errorsText(check.errors)}`);
  if(item.status>=400)assert.ok(!Array.isArray(data),'An error must not be an empty list.');
}
for(const [catalogue,body] of [['scripture-catalogue','scripture-body'],['scripture-two-cantos-catalogue','scripture-two-cantos']]){
  const entry=JSON.parse(await read(`fixtures/${catalogue}.json`))[0];
  const raw=await read(`fixtures/${body}.json`);
  assert.equal(createHash('sha256').update(raw,'utf8').digest('hex'),entry.contentHash);
  assert.equal(JSON.parse(raw).length,entry.verseCount);
}
const cantos=JSON.parse(await read('fixtures/scripture-two-cantos.json'));
assert.equal(new Set(cantos.map(row=>`${row.canto}.${row.chapter}.${row.verse}`)).size,2);
const drafts=JSON.parse(await read('editorial-library-90-day-drafts.json'));
assert.equal(drafts.entries.length,90);assert.equal(drafts.autoPublish,false);
assert.ok(drafts.entries.every((entry,index)=>entry.slot===index+1&&entry.state==='draft'&&entry.scriptureId===null&&entry.rightsStatus==='unknown'));
console.log(`PASS ${manifest.items.length} API fixtures, 2 byte-for-byte scripture hashes, canto identity and 90 unpublished editorial briefs.`);
