import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ApiError, failure, requestedDay } from '@/lib/api';
import { isSupportedLocale, stableDailyIndex } from '@/lib/dailyVerses';

export async function GET(req:NextRequest){
  try {
    const day=requestedDay(req.nextUrl.searchParams.get('date'));
    const rawLocale=req.nextUrl.searchParams.get('locale')??'en';
    if(!isSupportedLocale(rawLocale)||rawLocale.length>16)throw new ApiError(400,'Invalid locale.');
    const locale=Intl.getCanonicalLocales(rawLocale)[0];
    let selected;
    for(const language of [...new Set([locale,locale.split('-')[0],'en'])]) {
      const rows=(await query(`SELECT q.* FROM quotes q WHERE q.is_active AND q.publication_state='published'
        AND q.lock_screen_eligible AND q.locale=$2 AND (q.display_date=$1::date OR q.display_date IS NULL)
        AND (q.verse_id IS NULL OR EXISTS(SELECT 1 FROM scripture_verses v JOIN scriptures s ON s.id=v.scripture_id WHERE v.id=q.verse_id AND s.is_active AND s.publication_state='published'))
        ORDER BY (q.display_date IS NOT NULL) DESC,q.id`,[day,language])).rows;
      const scheduled=rows.filter(row=>row.display_date!==null);
      const candidates=scheduled.length?scheduled:rows;
      selected=candidates[scheduled.length?0:stableDailyIndex(day,candidates.length)];
      if(selected)break;
    }
    if(!selected)throw new ApiError(404,'No published quote available. Use the bundled fallback and respect the local visibility setting.');
    const q=selected;
    return NextResponse.json({id:q.id,date:day,text:q.text,kind:q.kind,locale:q.locale,requestedLocale:locale,languageFallback:q.locale!==locale,
      attribution:q.attribution,reference:q.reference,verseId:q.verse_id,theme:q.theme,source:q.source_name,sourceUrl:q.source_url,
      translator:q.translator,edition:q.edition,provenance:q.provenance,rightsStatus:q.rights_status,revision:q.revision,
      scheduled:Boolean(q.display_date),timezone:'Asia/Kolkata',lockScreenEligible:q.lock_screen_eligible,
      visibilityPolicy:'android-user-setting'}, {headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error);}
}
