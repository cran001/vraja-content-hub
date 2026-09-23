import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin';
import { failure } from '@/lib/api';
import * as panchang from '@/lib/panchangClient';

export const GET = withAdmin(async (req: NextRequest) => {
  try {
    const params = new URLSearchParams(req.nextUrl.searchParams);
    const mode = params.get('mode') || 'day';
    const date = params.get('date');
    const year = params.get('year');
    const place = params.get('place') || undefined;
    const lat = params.get('lat') ? parseFloat(params.get('lat')!) : undefined;
    const lon = params.get('lon') ? parseFloat(params.get('lon')!) : undefined;
    const elevation = params.get('elevation') ? parseFloat(params.get('elevation')!) : undefined;
    const tz = params.get('tz') || undefined;

    // Check if service is configured
    if (!panchang.isServiceConfigured()) {
      return NextResponse.json({
        available: false,
        reason: 'Panchang service is not configured. Set PANCHANG_SERVICE_URL environment variable.',
        mode,
        requestedDate: date,
        requestedYear: year,
        requestedPlace: place,
      });
    }

    if (mode === 'day') {
      if (!date) {
        return failure(new Error('date parameter required for day mode'));
      }

      const result = await panchang.getDay({ date, place, lat, lon, elevation, tz });

      if (!result.success) {
        return NextResponse.json({
          available: false,
          error: result.error,
          mode,
          requestedDate: date,
          requestedPlace: place,
        });
      }

      const data = result.data;
      const observances = panchang.extractApprovedObservances(data);
      const events = panchang.extractApprovedEvents(data);

      return NextResponse.json({
        available: true,
        mode: 'day',
        schemaVersion: data.schemaVersion,
        date: data.date,
        location: data.location,
        observances: {
          publication: data.ekadashiYear.publication,
          available: observances !== null,
          data: observances,
          unavailabilityReason: panchang.getUnavailabilityReason(data.ekadashiYear.publication),
        },
        events: {
          publication: data.yearResolution.publication,
          available: events !== null,
          data: events,
          unavailabilityReason: panchang.getUnavailabilityReason(data.yearResolution.publication),
        },
      });
    } else if (mode === 'calendar') {
      if (!year) {
        return failure(new Error('year parameter required for calendar mode'));
      }

      const yearNum = parseInt(year, 10);
      const result = await panchang.getCalendar({ year: yearNum, place, lat, lon, elevation, tz });

      if (!result.success) {
        return NextResponse.json({
          available: false,
          error: result.error,
          mode,
          requestedYear: yearNum,
          requestedPlace: place,
        });
      }

      const data = result.data;
      const observances = panchang.extractApprovedObservances(data);
      const events = panchang.extractApprovedEvents(data);

      return NextResponse.json({
        available: true,
        mode: 'calendar',
        schemaVersion: data.schemaVersion,
        year: data.year,
        location: data.location,
        observances: {
          publication: data.ekadashiYear.publication,
          available: observances !== null,
          count: observances?.length ?? 0,
          unavailabilityReason: panchang.getUnavailabilityReason(data.ekadashiYear.publication),
        },
        events: {
          publication: data.yearResolution.publication,
          available: events !== null,
          count: events?.length ?? 0,
          unavailabilityReason: panchang.getUnavailabilityReason(data.yearResolution.publication),
        },
      });
    } else if (mode === 'places') {
      const result = await panchang.getPlaces();

      if (!result.success) {
        return NextResponse.json({
          available: false,
          error: result.error,
          mode: 'places',
        });
      }

      return NextResponse.json({
        available: true,
        mode: 'places',
        places: result.data,
      });
    } else {
      return failure(new Error('Invalid mode. Use: day, calendar, or places'));
    }
  } catch (error) {
    return failure(error);
  }
});
