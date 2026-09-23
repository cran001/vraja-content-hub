import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { failure, indiaDate } from '@/lib/api';
import { datedEventSelection } from '@/lib/eventSelection';
import { addDays } from '@/lib/datedEvents';

export const GET=withAdmin(async(req:NextRequest)=>{
  try {
    const params=new URLSearchParams(req.nextUrl.searchParams);
    const from=params.get('from')??indiaDate();
    const to=params.get('to')??addDays(from,89);
    params.set('from',from);params.set('to',to);
    const items=await datedEventSelection(params);
    const coverage=[];
    for(let day=from;day<=to;day=addDays(day,1)){
      const events=items.filter(item=>item.date===day);
      coverage.push({date:day,count:events.length,withoutPublishedEvent:!events.length,
        timingWithheld:events.filter(item=>item.timingWithheld).length,
        languageFallback:events.filter(item=>item.languageFallback).length});
    }
    return NextResponse.json({from,to,items,coverage,timezone:'Asia/Kolkata',
      note:'A day without an editorial event is not a Panchang calculation gap.'});
  }catch(error){return failure(error);}
});
