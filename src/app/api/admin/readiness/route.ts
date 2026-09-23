import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { query } from '@/lib/db';
import { capabilities } from '@/lib/readiness';
import { EDITORIAL_TABLES } from '@/lib/editorial';
export const GET=withAdmin(async()=>{
  const collections=[];
  for(const table of EDITORIAL_TABLES){
    const row=(await query(`SELECT count(*)::int AS total,
      count(*) FILTER(WHERE publication_state='draft')::int AS drafts,
      count(*) FILTER(WHERE publication_state='review')::int AS reviewed,
      count(*) FILTER(WHERE publication_state='published')::int AS published,
      count(*) FILTER(WHERE rights_status='unknown' OR source_name IS NULL OR provenance IS NULL)::int AS missing_provenance,
      count(*) FILTER(WHERE updated_at<now()-interval '180 days')::int AS stale FROM ${table}`)).rows[0];
    collections.push({collection:table,...row});
  }
  const media=(await query("SELECT count(*) FILTER(WHERE description IS NULL OR alt_text IS NULL)::int AS missing_descriptions,count(*) FILTER(WHERE original_url IS NULL)::int AS missing_assets FROM wallpapers")).rows[0];
  const translations=(await query("SELECT count(*) FILTER(WHERE locale LIKE 'hi%')::int AS hindi,count(*) FILTER(WHERE locale LIKE 'en%')::int AS english FROM daily_verses WHERE publication_state='published'")).rows[0];
  const duplicates=(await query('SELECT event_date,lower(title) AS title,count(*)::int AS count FROM dated_events GROUP BY event_date,lower(title) HAVING count(*)>1')).rows;
  return NextResponse.json({...(await capabilities()),collections,media,translations,eventDuplicates:duplicates,
    cleanupPending:(await query('SELECT count(*)::int AS count FROM media_cleanup')).rows[0].count,
    deviceSyncTelemetry:'unavailable',recentAudit:(await query('SELECT id,actor_id,entity_type,entity_id,action,occurred_at FROM content_audit ORDER BY id DESC LIMIT 50')).rows});
});
