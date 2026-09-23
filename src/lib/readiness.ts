import { query } from './db';
import { isServiceConfigured } from './panchangClient';

export const CAPABILITIES=['daily-verse','dated-events','wallpaper-categories','media-metadata','scripture-version-hash','book-stories','lock-screen-quotes','panchang-preview'];
export async function capabilities(){
  const tables=['daily_verses','daily_assignments','scripture_snapshots','quotes','content_audit','media_uploads'];
  const schema=(await query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND (table_name=ANY($1::text[]) OR table_name IN ('wallpapers','books','dated_events'))",[tables])).rows;
  const required=[...tables.map(table=>[table,'id']),['scripture_snapshots','hash'],['wallpapers','publication_state'],['wallpapers','lock_screen_eligible'],['books','story_body'],['dated_events','timing_location'],['dated_events','applicability']].filter(([table,column])=>!(table==='scripture_snapshots'&&column==='id'));
  const ready=required.every(([table,column])=>schema.some(row=>row.table_name===table&&row.column_name===column));
  const revision=process.env.VERCEL_GIT_COMMIT_SHA??process.env.HUB_REVISION??'';
  const panchangConfigured=isServiceConfigured();
  return {status:ready?'ready':'schema_incomplete',apiVersion:'1.2',revision:/^[a-f0-9]{7,40}$/i.test(revision)?revision:'local-unreleased',
    capabilities:ready?CAPABILITIES:[],schemaReady:ready,androidConsumerVerified:false,
    panchangService:{configured:panchangConfigured,note:panchangConfigured?'Preview available in admin dashboard':'Set PANCHANG_SERVICE_URL to enable'}};
}
