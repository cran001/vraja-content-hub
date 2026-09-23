"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/context/ToastContext';
type Row=Record<string,unknown>;
const collections=['daily_verses','scriptures','wallpapers','dated_events','books','quotes'];
const labels:Record<string,string>={source_name:'Source / author',source_url:'Source URL',translator:'Translator',edition:'Edition',provenance:'Provenance and permission evidence',rights_status:'Rights status',reviewer_notes:'Reviewer notes',translation_locale:'Translation language',description_hi:'Hindi description',fasting_guidelines_hi:'Hindi fasting guidance',applicability:'Applicability',scope_key:'Tradition / region / location key',timing_timezone:'Timing timezone (IANA)',timing_location:'Timing location key',timing_source:'Timing source',description:'Image description',alt_text:'Alt text',deity:'Deity',temple:'Temple',location:'Place',credit:'Artist / photographer credit',locale:'Language'};
const shared=['source_name','source_url','translator','edition','provenance','rights_status','reviewer_notes'];
export async function adminFetch(url:string,options:RequestInit={}){
  const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${localStorage.getItem('authToken')}`,'Content-Type':'application/json',...options.headers}});
  const data=await response.json();
  if(!response.ok)throw new Error(data.message??'Request failed.');
  return data;
}

export default function EditorialWorkbench(){
  const {showToast}=useToast();
  const [collection,setCollection]=useState('daily_verses');
  const [rows,setRows]=useState<Row[]>([]);const [selected,setSelected]=useState<Row|null>(null);
  const [draft,setDraft]=useState<Record<string,string>>({});const [busy,setBusy]=useState(false);
  const [page,setPage]=useState(1);
  const load=useCallback(async()=>{try{const data=await adminFetch(`/api/admin/editorial?collection=${collection}&page=${page}`);setRows(data.items);setSelected(null);}catch(error){showToast(String(error),'error');}},[collection,page,showToast]);
  useEffect(()=>{void load();},[load]);
  const extra=collection==='daily_verses'?['translation_locale']:collection==='dated_events'?['description_hi','fasting_guidelines_hi','applicability','scope_key','timing_timezone','timing_location','timing_source']:[];
  const mediaFields=collection==='wallpapers'?['description','alt_text','deity','temple','location','credit','locale']:[];
  const fields=[...shared,...extra,...mediaFields];
  const choose=(row:Row)=>{setSelected(row);setDraft(Object.fromEntries(fields.map(f=>[f,String(row[f]??'')])));};
  const dirty=selected&&fields.some(f=>(draft[f]??'')!==String(selected[f]??''));
  const act=async(action:string)=>{
    if(!selected)return;setBusy(true);
    try{
      let current=selected;
      const media=Object.fromEntries(mediaFields.filter(f=>(draft[f]??'')!==String(current[f]??'')).map(f=>[f,draft[f]||null]));
      if(Object.keys(media).length)current=await adminFetch('/api/admin/wallpapers',{method:'PUT',body:JSON.stringify({id:current.id,...media})});
      const metadata=action==='publish'?{}:Object.fromEntries([...shared,...extra].filter(f=>(draft[f]??'')!==String(current[f]??'')).map(f=>[f,draft[f]||null]));
      const updated=await adminFetch('/api/admin/editorial',{method:'PUT',body:JSON.stringify({collection,id:current.id,expected_revision:current.revision,action,metadata})});
      setRows(prev=>prev.map(row=>row.id===updated.id?updated:row));choose(updated);showToast(`Saved: ${updated.publication_state}.`);
    }catch(error){showToast(String(error),'error');}finally{setBusy(false);}
  };
  return <div>
    <p>New content starts as a draft. Save its source details, review it, then publish. Existing published content with unknown provenance remains flagged for review.</p>
    <div className="toolbar"><label>Collection <select className="form-select" value={collection} onChange={e=>{setCollection(e.target.value);setPage(1);}}>{collections.map(c=><option key={c}>{c}</option>)}</select></label><button className="btn btn-secondary" onClick={()=>void load()}>Refresh</button></div>
    <div className="editorial-grid"><div className="card">
      {!rows.length&&<p>No records in this collection.</p>}
      {rows.map(row=><button key={String(row.id)} className="editorial-row" onClick={()=>choose(row)}><strong>{String(row.title??row.name??row.reference??row.theme??row.id)}</strong><span>{String(row.publication_state)} · revision {String(row.revision)}</span><small>{String(row.id)}</small></button>)}
      <div className="toolbar"><button className="btn btn-secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page}</span><button className="btn btn-secondary" disabled={rows.length<100} onClick={()=>setPage(page+1)}>Next</button></div>
    </div><div className="card">{selected?<>
      <h3>{String(selected.title??selected.name??selected.theme??'Editorial record')}</h3><p>State: <strong>{String(selected.publication_state)}</strong></p>
      {selected.reflection!=null&&<blockquote>{String(selected.reflection)}</blockquote>}
      {selected.text!=null&&<blockquote>{String(selected.text)}</blockquote>}
      {fields.map(field=><label className="form-group" key={field}><span className="form-label">{labels[field]??field}</span>
        {field==='rights_status'?<select className="form-select" value={draft[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})}>{['unknown','original','licensed','public_domain'].map(v=><option key={v}>{v}</option>)}</select>
        :field==='applicability'?<select className="form-select" value={draft[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})}>{['global','tradition','region','location'].map(v=><option key={v}>{v}</option>)}</select>
        :<textarea className="form-textarea" rows={['reviewer_notes','provenance','description','description_hi','alt_text'].includes(field)?3:1} value={draft[field]??''} onChange={e=>setDraft({...draft,[field]:e.target.value})}/>}</label>)}
      <div className="toolbar"><button className="btn btn-secondary" disabled={busy} onClick={()=>void act('metadata')}>Save metadata</button><button className="btn btn-primary" disabled={busy} onClick={()=>void act('review')}>Mark reviewed</button><button className="btn btn-primary" disabled={busy||Boolean(dirty)||selected.publication_state!=='review'} onClick={()=>void act('publish')}>Publish reviewed content</button><button className="btn btn-secondary" disabled={busy} onClick={()=>void act('unpublish')}>Unpublish</button><button className="btn btn-secondary" disabled={busy} onClick={()=>void act('archive')}>Archive</button></div>
      {dirty&&<p>Save and review changes before publishing.</p>}
    </>:<p>Select a record to review its source and publication state.</p>}</div></div>
  </div>;
}

export function DailyPreview(){
  const [date,setDate]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date()));
  const [locale,setLocale]=useState('en');const [result,setResult]=useState<Row|null>(null);const [coverage,setCoverage]=useState<Row[]>([]);const [error,setError]=useState('');
  const load=async(calendar=false)=>{setError('');try{const data=await adminFetch(`/api/admin/daily-preview?date=${date}&locale=${encodeURIComponent(locale)}${calendar?'&coverage=true':''}`);if(calendar)setCoverage(data.items);else setResult(data);}catch(e){setError(String(e));}};
  const correction=async()=>{const id=prompt('Published daily-selection ID for the reviewed correction:');if(!id)return;const reason=prompt('Reason for this reviewed correction:');if(!reason)return;try{setResult(await adminFetch('/api/admin/daily-preview',{method:'POST',body:JSON.stringify({date,locale,id,reason})}));}catch(e){setError(String(e));}};
  return <div className="card"><h3>Daily preview and publishing calendar</h3><div className="toolbar"><input aria-label="Preview date" className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/><input aria-label="Preview language" className="form-input" value={locale} onChange={e=>setLocale(e.target.value)}/><button className="btn btn-primary" onClick={()=>void load()}>Preview</button><button className="btn btn-secondary" onClick={()=>void load(true)}>90-day coverage</button><button className="btn btn-secondary" onClick={()=>void correction()}>Reviewed day correction</button></div>{error&&<p role="alert">{error}</p>}{result&&<div><strong>{String(result.reference)} · {String(result.locale)} · {String(result.selectionMode)}</strong><p>{String(result.translation)}</p><p>{String(result.reflection)}</p><small>{result.languageFallback?'Language fallback. ':''}{result.frozen?'Day selection is fixed. ':''}Revision {String(result.assignmentRevision)}</small></div>}<div className="coverage-grid">{coverage.map(day=><div className={day.gap?'coverage-gap':'coverage-ready'} key={String(day.date)}><strong>{String(day.date)}</strong><small>{day.unavailable?'No eligible content':day.gap?'Pool / schedule gap':'Scheduled'} · {String(day.locale??locale)}</small></div>)}</div></div>;
}

export function ReadinessDashboard(){
  const [data,setData]=useState<Row|null>(null);const [error,setError]=useState('');
  useEffect(()=>{adminFetch('/api/admin/readiness').then(setData).catch(e=>setError(String(e)));},[]);
  if(error)return <p role="alert">{error}</p>;
  if(!data)return <p>Loading readiness…</p>;
  return <div><p>Hub schema: <strong>{String(data.status)}</strong>. Revision: {String(data.revision)}. Device sync telemetry is unavailable.</p><div className="readiness-grid">{(data.collections as Row[]).map(row=><div className="card" key={String(row.collection)}><h3>{String(row.collection)}</h3><p>{String(row.published)} published · {String(row.drafts)} drafts · {String(row.reviewed)} reviewed</p><p>{String(row.missing_provenance)} missing provenance · {String(row.stale)} older than 180 days</p></div>)}</div><p>Pending asset cleanup: {String(data.cleanupPending)}</p><p>Published daily translations: {JSON.stringify(data.translations)}</p><p>Media gaps: {JSON.stringify(data.media)}</p><h3>Potential calendar duplicates</h3><pre className="editorial-json">{JSON.stringify(data.eventDuplicates,null,2)}</pre><h3>Recent editorial actions</h3><pre className="editorial-json">{JSON.stringify(data.recentAudit,null,2)}</pre><DailyPreview/></div>;
}

export function CalendarPreview(){
  const [from,setFrom]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date()));
  const [to,setTo]=useState('');
  const [locale,setLocale]=useState('en');
  const [location,setLocation]=useState('');
  const [timezone,setTimezone]=useState('Asia/Kolkata');
  const [region,setRegion]=useState('');
  const [tradition,setTradition]=useState('');
  const [data,setData]=useState<Row|null>(null);
  const [error,setError]=useState('');
  const load=async()=>{
    setError('');
    try{
      const params=new URLSearchParams({from,locale,timezone});
      for(const [key,value] of Object.entries({to,location,region,tradition}))if(value)params.set(key,value);
      setData(await adminFetch(`/api/admin/calendar-preview?${params}`));
    }catch(e){setError(String(e));}
  };
  return <div className="card"><h3>Calendar preview and coverage</h3>
    <p>Preview published events for a place and language. Days without editorial events are normal; precise Panchang stays in the app calculation engine.</p>
    <div className="toolbar">
      <label>From<input className="form-input" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
      <label>Through (default 90 days)<input className="form-input" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
      {([{label:'Language',value:locale,set:setLocale},{label:'Location key',value:location,set:setLocation},{label:'Timezone',value:timezone,set:setTimezone},{label:'Region key',value:region,set:setRegion},{label:'Tradition key',value:tradition,set:setTradition}]).map(field=><label key={field.label}>{field.label}<input className="form-input" value={field.value} onChange={e=>field.set(e.target.value)}/></label>)}
      <button className="btn btn-primary" onClick={()=>void load()}>Preview range</button>
    </div>
    {error&&<p role="alert">{error}</p>}
    {data&&<><div className="coverage-grid">{(data.coverage as Row[]).map(day=><div className={day.withoutPublishedEvent?'coverage-gap':'coverage-ready'} key={String(day.date)}><strong>{String(day.date)}</strong><small>{String(day.count)} events, {String(day.timingWithheld)} timings withheld, {String(day.languageFallback)} language fallbacks</small></div>)}</div><h4>Selected events</h4><pre className="editorial-json">{JSON.stringify(data.items,null,2)}</pre></>}
  </div>;
}

export function PanchangPreview(){
  const [mode,setMode]=useState('day');
  const [date,setDate]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date()));
  const [year,setYear]=useState(new Date().getFullYear().toString());
  const [place,setPlace]=useState('');
  const [lat,setLat]=useState('');
  const [lon,setLon]=useState('');
  const [elevation,setElevation]=useState('');
  const [tz,setTz]=useState('Asia/Kolkata');
  const [data,setData]=useState<Row|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const load=async()=>{
    setError('');
    setLoading(true);
    try{
      const params=new URLSearchParams({mode});
      if(mode==='day')params.set('date',date);
      if(mode==='calendar')params.set('year',year);
      if(place)params.set('place',place);
      else{
        if(lat)params.set('lat',lat);
        if(lon)params.set('lon',lon);
        if(elevation)params.set('elevation',elevation);
        if(tz)params.set('tz',tz);
      }
      setData(await adminFetch(`/api/admin/panchang-preview?${params}`));
    }catch(e){setError(String(e));}finally{setLoading(false);}
  };
  return <div className="card">
    <h3>Panchang Service Preview (Read-Only)</h3>
    <p>Preview calculated guidance from the external Panchang service. This is separate from editorial Hub events. Observances and events have independent publication states.</p>
    <div className="toolbar">
      <label>Mode
        <select className="form-select" value={mode} onChange={e=>setMode(e.target.value)}>
          <option value="day">Day</option>
          <option value="calendar">Year</option>
          <option value="places">Places</option>
        </select>
      </label>
      {mode==='day'&&<label>Date<input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>}
      {mode==='calendar'&&<label>Year<input className="form-input" type="number" value={year} onChange={e=>setYear(e.target.value)} min="2000" max="2100"/></label>}
      {mode!=='places'&&<>
        <label>Place key (optional)<input className="form-input" placeholder="e.g. mayapur" value={place} onChange={e=>setPlace(e.target.value)}/></label>
        <label>Latitude<input className="form-input" type="number" step="0.000001" value={lat} onChange={e=>setLat(e.target.value)} disabled={Boolean(place)}/></label>
        <label>Longitude<input className="form-input" type="number" step="0.000001" value={lon} onChange={e=>setLon(e.target.value)} disabled={Boolean(place)}/></label>
        <label>Elevation (m)<input className="form-input" type="number" value={elevation} onChange={e=>setElevation(e.target.value)} disabled={Boolean(place)}/></label>
        <label>Timezone<input className="form-input" value={tz} onChange={e=>setTz(e.target.value)} disabled={Boolean(place)}/></label>
      </>}
      <button className="btn btn-primary" onClick={()=>void load()} disabled={loading}>{loading?'Loading...':'Preview'}</button>
    </div>
    {error&&<p role="alert">{error}</p>}
    {data&&!data.available?<div className="alert alert-warning">
      <strong>Unavailable</strong>
      <p>{String(data.reason||'Service unavailable')}</p>
      {data.error?<pre className="editorial-json">{JSON.stringify(data.error,null,2)}</pre>:null}
    </div>:null}
    {data&&data.available&&mode==='places'?<div>
      <h4>Available Places</h4>
      <ul>{(data.places as Row[]).map(p=><li key={String(p.key)}>
        <strong>{String(p.displayName)}</strong> ({String(p.key)})<br/>
        <small>Lat: {String(p.latitude)}, Lon: {String(p.longitude)}, TZ: {String(p.timezone)}{p.elevation?`, Elevation: ${String(p.elevation)}m`:''}</small>
      </li>)}</ul>
    </div>:null}
    {data&&data.available&&mode!=='places'?<div>
      <div className="alert alert-info">
        <strong>Location</strong>
        <p>{String((data.location as Record<string,unknown>)?.displayName)} ({String((data.location as Record<string,unknown>)?.key)})</p>
        <small>Lat: {String((data.location as Record<string,unknown>)?.latitude)}, Lon: {String((data.location as Record<string,unknown>)?.longitude)}, Elevation: {String((data.location as Record<string,unknown>)?.elevation)}m, Timezone: {String((data.location as Record<string,unknown>)?.timezone)}</small>
      </div>
      <div className="panchang-section">
        <h4>Observances (Ekadashi Year)</h4>
        <p><strong>State:</strong> {String(((data.observances as Record<string,unknown>)?.publication as Record<string,unknown>)?.state)} | <strong>Guidance:</strong> {String(((data.observances as Record<string,unknown>)?.publication as Record<string,unknown>)?.guidance)}</p>
        {!(data.observances as Record<string,unknown>)?.available?<p className="alert alert-warning">{String((data.observances as Record<string,unknown>)?.unavailabilityReason||'Guidance withheld')}</p>:null}
        {(data.observances as Record<string,unknown>)?.available?<div>
          {mode==='calendar'?<p>{String((data.observances as Record<string,unknown>)?.count||0)} observances in {String(data.year)}</p>:null}
          {(data.observances as Record<string,unknown>)?.data?<pre className="editorial-json">{JSON.stringify((data.observances as Record<string,unknown>).data,null,2)}</pre>:null}
        </div>:null}
      </div>
      <div className="panchang-section">
        <h4>Events (Year Resolution)</h4>
        <p><strong>State:</strong> {String(((data.events as Record<string,unknown>)?.publication as Record<string,unknown>)?.state)} | <strong>Guidance:</strong> {String(((data.events as Record<string,unknown>)?.publication as Record<string,unknown>)?.guidance)}</p>
        {!(data.events as Record<string,unknown>)?.available?<p className="alert alert-warning">{String((data.events as Record<string,unknown>)?.unavailabilityReason||'Guidance withheld')}</p>:null}
        {(data.events as Record<string,unknown>)?.available?<div>
          {mode==='calendar'?<p>{String((data.events as Record<string,unknown>)?.count||0)} events in {String(data.year)}</p>:null}
          {(data.events as Record<string,unknown>)?.data?<pre className="editorial-json">{JSON.stringify((data.events as Record<string,unknown>).data,null,2)}</pre>:null}
        </div>:null}
      </div>
    </div>:null}
  </div>;
}
