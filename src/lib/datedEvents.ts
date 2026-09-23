/**
 * Dated events: shared vocabulary, validation and row → API mapping.
 *
 * Imported by the public endpoint, the admin CRUD endpoint AND the admin UI, so the browser
 * and the server agree on what a valid event looks like — the form can never submit something
 * the API will reject, and the API never trusts that it didn't.
 *
 * Nothing here touches the database or any Node-only API; it must stay client-safe.
 */

// ─────────────────────────────────────────────────────────────
// Vocabulary
// ─────────────────────────────────────────────────────────────

/**
 * The event types the Android app knows how to badge. Validated here rather than by a database
 * CHECK so this list can grow without a migration; the parana shape, which mis-renders when
 * wrong, is constrained in the schema instead.
 */
export const EVENT_TYPES = [
  'Festival',
  'Ekadashi',
  'Appearance',
  'Disappearance',
  'Parana',
  'Special Observance',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/**
 * How a parana window is expressed.
 *   none   — no fast-breaking timing on this event
 *   window — start and end are both known: "Parana: 06:12 - 10:50"
 *   after  — Hari Vasara ends past one-third of daylight, so the fast may only be broken
 *            after the start time: "Parana after 10:50". There is no end time.
 */
export type ParanaType = 'window' | 'after';

// ─────────────────────────────────────────────────────────────
// Primitive validators
// ─────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True for a real yyyy-MM-dd calendar date (rejects 2026-02-30 and 2026-13-01). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** True for a 24-hour HH:mm clock time. */
export function isHhMm(value: unknown): value is string {
  return typeof value === 'string' && HH_MM.test(value);
}

/** Minutes since midnight, for ordering two HH:mm strings. */
export function minutesOfDay(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Adds whole days to a yyyy-MM-dd date, returning yyyy-MM-dd. Invalid input passes through. */
export function addDays(isoDate: string, days: number): string {
  if (!isIsoDate(isoDate)) return isoDate;
  const [year, month, day] = isoDate.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** The parana date the editor gets by default: the day after the fast. */
export function defaultParanaDate(eventDate: string): string {
  return addDays(eventDate, 1);
}

/**
 * Normalises a time to HH:mm. Accepts the HH:mm:ss that Postgres `time` columns return, and
 * trims stray whitespace from hand-typed input. Returns null when there is nothing usable.
 */
export function normaliseTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!match) return null;
  const candidate = `${match[1].padStart(2, '0')}:${match[2]}`;
  return isHhMm(candidate) ? candidate : null;
}

/** Normalises a date to yyyy-MM-dd, accepting the Date objects `pg` returns for `date` columns. */
export function normaliseDate(value: unknown): string | null {
  if (value instanceof Date) {
    // pg parses `date` in the server's local zone; read it back the same way so the calendar
    // day never shifts by one.
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 10);
  return isIsoDate(trimmed) ? trimmed : null;
}

// ─────────────────────────────────────────────────────────────
// Event validation
// ─────────────────────────────────────────────────────────────

/** An event as the editor holds it — every field a string, exactly like form state. */
export interface DatedEventInput {
  title?: string | null;
  titleHi?: string | null;
  eventType?: string | null;
  date?: string | null;
  description?: string | null;
  descriptionHi?: string | null;
  fastingGuidelines?: string | null;
  fastingGuidelinesHi?: string | null;
  applicability?: string | null;
  scopeKey?: string | null;
  timingLocation?: string | null;
  timingTimezone?: string | null;
  timingSource?: string | null;
  paranaType?: string | null;
  paranaDate?: string | null;
  paranaStartTime?: string | null;
  paranaEndTime?: string | null;
  timeSlot?: string | null;
  detailsUrl?: string | null;
  isMajorEvent?: boolean;
  isActive?: boolean;
  cancelled?: boolean;
}

/** The validated, storage-ready shape. */
export interface DatedEventFields {
  title: string;
  titleHi: string | null;
  eventType: EventType;
  date: string;
  description: string;
  descriptionHi: string | null;
  fastingGuidelines: string | null;
  fastingGuidelinesHi: string | null;
  applicability: 'global' | 'tradition' | 'region' | 'location';
  scopeKey: string | null;
  timingLocation: string | null;
  timingTimezone: string | null;
  timingSource: string | null;
  paranaType: ParanaType | null;
  paranaDate: string | null;
  paranaStartTime: string | null;
  paranaEndTime: string | null;
  timeSlot: string | null;
  detailsUrl: string | null;
  isMajorEvent: boolean;
  isActive: boolean;
  cancelled: boolean;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const trimOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Validates one event and derives its parana shape.
 *
 * The parana rules are the reason this function exists:
 *   1. A window needs date + start + end, with end strictly after start.
 *   2. The boundary case needs date + start and paranaType 'after', with no end.
 *   3. Anything else that has a start time is a half-specified window and is rejected —
 *      publishing one would make the app render a broken or misleading timing.
 *
 * paranaType may be omitted by the caller: 'window' is inferred when an end time is present.
 */
export function validateDatedEvent(input: DatedEventInput): ValidationResult<DatedEventFields> {
  const errors: string[] = [];

  const title = trimOrNull(input.title);
  if (!title) errors.push('Title is required.');
  else if (title.length > 255) errors.push('Title must be 255 characters or fewer.');

  const titleHi = trimOrNull(input.titleHi);
  if (titleHi && titleHi.length > 255) errors.push('Hindi title must be 255 characters or fewer.');

  const descriptionHi = trimOrNull(input.descriptionHi);
  if (descriptionHi && descriptionHi.length > 5000) errors.push('Hindi description must be 5000 characters or fewer.');

  const fastingGuidelinesHi = trimOrNull(input.fastingGuidelinesHi);
  if (fastingGuidelinesHi && fastingGuidelinesHi.length > 5000) errors.push('Hindi fasting guidelines must be 5000 characters or fewer.');

  // Applicability and scope validation
  const applicability = trimOrNull(input.applicability) || 'global';
  if (!['global', 'tradition', 'region', 'location'].includes(applicability)) {
    errors.push('Applicability must be: global, tradition, region, or location.');
  }

  const scopeKey = trimOrNull(input.scopeKey);
  if (applicability !== 'global' && !scopeKey) {
    errors.push(`Scope key is required for ${applicability} applicability.`);
  }
  if (scopeKey && scopeKey.length > 255) {
    errors.push('Scope key must be 255 characters or fewer.');
  }

  // Timing metadata validation
  const timingLocation = trimOrNull(input.timingLocation);
  const timingTimezone = trimOrNull(input.timingTimezone);
  const timingSource = trimOrNull(input.timingSource);

  if (timingLocation && timingLocation.length > 255) errors.push('Timing location must be 255 characters or fewer.');
  if (timingTimezone && timingTimezone.length > 100) errors.push('Timing timezone must be 100 characters or fewer.');
  if (timingSource && timingSource.length > 500) errors.push('Timing source must be 500 characters or fewer.');

  // Validate timezone if provided
  if (timingTimezone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: timingTimezone }).format();
    } catch {
      errors.push('Timing timezone must be a valid IANA timezone.');
    }
  }

  const rawType = trimOrNull(input.eventType);
  if (!rawType) errors.push('Event type is required.');
  else if (!(EVENT_TYPES as readonly string[]).includes(rawType)) {
    errors.push(`Event type must be one of: ${EVENT_TYPES.join(', ')}.`);
  }

  const date = trimOrNull(input.date);
  if (!date) errors.push('Date is required.');
  else if (!isIsoDate(date)) errors.push('Date must be a real calendar date in yyyy-MM-dd form.');

  const detailsUrl = trimOrNull(input.detailsUrl);
  if (detailsUrl && !/^https?:\/\//i.test(detailsUrl)) {
    errors.push('Details URL must start with http:// or https://.');
  }

  const timeSlot = trimOrNull(input.timeSlot);
  if (timeSlot && timeSlot.length > 100) {
    errors.push('Time slot must be 100 characters or fewer.');
  }

  // ── Parana shape ──
  const requestedType = trimOrNull(input.paranaType);
  if (requestedType && requestedType !== 'window' && requestedType !== 'after' && requestedType !== 'none') {
    errors.push("Parana type must be 'window', 'after' or omitted.");
  }

  const rawStart = trimOrNull(input.paranaStartTime);
  const rawEnd = trimOrNull(input.paranaEndTime);
  const rawParanaDate = trimOrNull(input.paranaDate);

  const start = rawStart ? normaliseTime(rawStart) : null;
  if (rawStart && !start) errors.push('Parana start time must be a 24-hour HH:mm time.');

  const end = rawEnd ? normaliseTime(rawEnd) : null;
  if (rawEnd && !end) errors.push('Parana end time must be a 24-hour HH:mm time.');

  if (rawParanaDate && !isIsoDate(rawParanaDate)) {
    errors.push('Parana date must be a real calendar date in yyyy-MM-dd form.');
  }

  const wantsAfter = requestedType === 'after';
  let paranaType: ParanaType | null = null;
  let paranaDate: string | null = null;
  let paranaStartTime: string | null = null;
  let paranaEndTime: string | null = null;

  if (requestedType === 'none') {
    // Explicitly cleared: drop any timing that came along with the payload.
    if (start || end || rawParanaDate) {
      // Not an error — the editor sends the whole form and lets 'none' win.
    }
  } else if (start) {
    paranaStartTime = start;
    paranaType = wantsAfter ? 'after' : 'window';

    if (wantsAfter) {
      if (end) {
        errors.push(
          "An 'after' parana has no end time — the fast may be broken any time past the start.",
        );
      }
    } else if (!end) {
      // Rule 3. Left unresolved this would publish a half-specified window.
      errors.push(
        'Parana needs an end time, or mark it "after" if the fast may only be broken past the start time.',
      );
    } else {
      paranaEndTime = end;
      if (minutesOfDay(end) <= minutesOfDay(start)) {
        errors.push('Parana end time must be after the parana start time.');
      }
    }

    // Rule 1 and 2 both carry the date. Default to the day after the fast.
    paranaDate =
      rawParanaDate && isIsoDate(rawParanaDate)
        ? rawParanaDate
        : date && isIsoDate(date)
          ? defaultParanaDate(date)
          : null;
    if (!paranaDate) errors.push('Parana date is required alongside a parana time.');
  } else {
    if (end) errors.push('Parana end time needs a parana start time.');
    if (wantsAfter) errors.push("An 'after' parana still needs the start time to break the fast past.");
    // A bare parana date with no times is inert for the app, so it is simply dropped.
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      title: title as string,
      titleHi,
      eventType: rawType as EventType,
      date: date as string,
      description: trimOrNull(input.description) ?? '',
      descriptionHi,
      fastingGuidelines: trimOrNull(input.fastingGuidelines),
      fastingGuidelinesHi,
      applicability: applicability as 'global' | 'tradition' | 'region' | 'location',
      scopeKey,
      timingLocation,
      timingTimezone,
      timingSource,
      paranaType,
      paranaDate,
      paranaStartTime,
      paranaEndTime,
      timeSlot,
      detailsUrl,
      isMajorEvent: input.isMajorEvent === true,
      isActive: input.isActive !== false,
      cancelled: input.cancelled === true,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Row → API mapping
// ─────────────────────────────────────────────────────────────

/** A `dated_events` row as `pg` hands it back. */
export interface DatedEventRow {
  id: string;
  title: string;
  title_hi: string | null;
  event_type: string;
  event_date: Date | string;
  description: string | null;
  fasting_guidelines: string | null;
  parana_date: Date | string | null;
  parana_start_time: string | null;
  parana_end_time: string | null;
  parana_type: string | null;
  time_slot: string | null;
  is_major_event: boolean;
  is_active?: boolean;
  image_url: string | null;
  details_url: string | null;
}

/** The camelCase event object the Android app parses. Optional keys are omitted, never null. */
export interface DatedEventPayload {
  id: string;
  title: string;
  titleHi?: string;
  eventType: string;
  date: string;
  description: string;
  imageUrl?: string;
  detailsUrl?: string;
  fastingGuidelines?: string;
  paranaDate?: string;
  paranaStartTime?: string;
  paranaEndTime?: string;
  paranaType?: 'after';
  timeSlot?: string;
  isMajorEvent: boolean;
}

/**
 * Maps a row to the public payload.
 *
 * Parana fields ship as a set or not at all: a start time always travels with its date, and
 * either an end time or `paranaType: "after"`. `paranaType` is emitted ONLY for the 'after'
 * shape — a consumer that branches on the key's mere presence then cannot mistake a normal
 * window for the boundary case. A row carrying a parana date but no time contributes nothing
 * to the app, so its date is dropped rather than published on its own.
 */
export function toDatedEventPayload(row: DatedEventRow): DatedEventPayload {
  const payload: DatedEventPayload = {
    id: row.id,
    title: row.title,
    eventType: row.event_type,
    date: normaliseDate(row.event_date) ?? '',
    description: row.description ?? '',
    isMajorEvent: row.is_major_event === true,
  };

  if (row.title_hi) payload.titleHi = row.title_hi;
  if (row.image_url) payload.imageUrl = row.image_url;
  if (row.details_url) payload.detailsUrl = row.details_url;
  if (row.fasting_guidelines) payload.fastingGuidelines = row.fasting_guidelines;
  if (row.time_slot) payload.timeSlot = row.time_slot;

  const start = normaliseTime(row.parana_start_time);
  const end = normaliseTime(row.parana_end_time);
  const paranaDate = normaliseDate(row.parana_date);

  if (start && paranaDate) {
    if (end) {
      payload.paranaDate = paranaDate;
      payload.paranaStartTime = start;
      payload.paranaEndTime = end;
    } else if (row.parana_type === 'after') {
      payload.paranaDate = paranaDate;
      payload.paranaStartTime = start;
      payload.paranaType = 'after';
    }
    // Any other combination is a half-specified window. The schema forbids storing one, but
    // the mapper drops it rather than publishing it if legacy data ever slips through.
  }

  return payload;
}
