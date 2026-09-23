/**
 * Panchang Service v2 Client
 *
 * Read-only typed client for the Panchang service v2 API.
 * Handles ISKCON tradition observances and events with explicit publication state validation.
 *
 * Requirements:
 * - Validates schemaVersion: 2
 * - Evaluates observance and event publication states independently
 * - Preserves null as withheld; approved [] means calculated absence
 * - Handles 410 migration, 422 unsupported scope, timeouts, and outages explicitly
 * - Never converts service failure into empty successful calendar
 * - Respects no-store caching
 * - Uses bounded requests with input validation
 */

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const PANCHANG_SERVICE_URL = process.env.PANCHANG_SERVICE_URL || '';
const PANCHANG_REQUEST_TIMEOUT_MS = parseInt(process.env.PANCHANG_REQUEST_TIMEOUT_MS || '10000', 10);
const MAX_LOCATION_KEY_LENGTH = 100;
const MAX_TIMEZONE_LENGTH = 100;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type PublicationState = 'APPROVED' | 'PENDING_REVIEW' | 'DISPUTED' | 'REVOKED' | 'UNAVAILABLE';
export type GuidanceAvailability = 'AVAILABLE' | 'WITHHELD';

export interface Publication {
  state: PublicationState;
  guidance: GuidanceAvailability;
}

export interface LocationResolution {
  key: string;
  displayName: string;
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string; // IANA timezone
}

export interface ParanaWindow {
  date: string; // ISO date
  start: string; // ISO 8601 offset timestamp
  end?: string; // ISO 8601 offset timestamp, absent for "after" type
  paranaType?: 'after';
}

export interface Observance {
  id: string;
  date: string; // ISO date - the fasting date
  title: string;
  titleHi?: string;
  type: string;
  description?: string;
  descriptionHi?: string;
  fastingGuidelines?: string;
  fastingGuidelinesHi?: string;
  parana?: ParanaWindow;
}

export interface Event {
  id: string;
  date: string; // ISO date
  title: string;
  titleHi?: string;
  type: string;
  description?: string;
  descriptionHi?: string;
}

export interface DayResolution {
  schemaVersion: number;
  location: LocationResolution;
  date: string;
  ekadashiYear: {
    publication: Publication;
  };
  yearResolution: {
    publication: Publication;
  };
  observances: Observance[] | null;
  events: Event[] | null;
}

export interface CalendarYear {
  schemaVersion: number;
  location: LocationResolution;
  year: number;
  ekadashiYear: {
    publication: Publication;
  };
  yearResolution: {
    publication: Publication;
  };
  observances: Observance[] | null;
  events: Event[] | null;
}

export interface PanchangPlace {
  key: string;
  displayName: string;
  latitude: number;
  longitude: number;
  timezone: string;
  elevation?: number;
}

export type PanchangServiceError =
  | { type: 'unavailable'; reason: 'not_configured' | 'network_error' | 'timeout' | 'service_error'; message: string }
  | { type: 'migration_required'; oldVersion: number; newVersion: number; message: string }
  | { type: 'unsupported_scope'; message: string }
  | { type: 'invalid_response'; message: string }
  | { type: 'invalid_input'; message: string };

export type PanchangResult<T> =
  | { success: true; data: T }
  | { success: false; error: PanchangServiceError };

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

function isConfigured(): boolean {
  return Boolean(PANCHANG_SERVICE_URL && PANCHANG_SERVICE_URL.startsWith('http'));
}

function validateDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

function validateYear(year: number): boolean {
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
}

function validateTimezone(tz: string): boolean {
  if (tz.length > MAX_TIMEZONE_LENGTH) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz }).format();
    return true;
  } catch {
    return false;
  }
}

function validateLocationKey(key: string): boolean {
  return key.length > 0 && key.length <= MAX_LOCATION_KEY_LENGTH && /^[a-z0-9_-]+$/i.test(key);
}

function validatePublication(pub: unknown): pub is Publication {
  if (!pub || typeof pub !== 'object') return false;
  const p = pub as Record<string, unknown>;
  return (
    typeof p.state === 'string' &&
    ['APPROVED', 'PENDING_REVIEW', 'DISPUTED', 'REVOKED', 'UNAVAILABLE'].includes(p.state) &&
    typeof p.guidance === 'string' &&
    ['AVAILABLE', 'WITHHELD'].includes(p.guidance)
  );
}

function validateSchemaVersion(data: unknown): data is { schemaVersion: 2 } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'schemaVersion' in data &&
    (data as { schemaVersion: unknown }).schemaVersion === 2
  );
}

function isGuidanceAvailable(publication: Publication): boolean {
  return publication.state === 'APPROVED' && publication.guidance === 'AVAILABLE';
}

// ─────────────────────────────────────────────────────────────
// HTTP Client
// ─────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

async function handlePanchangResponse<T>(response: Response): Promise<PanchangResult<T>> {
  // Handle 410 Gone - migration required
  if (response.status === 410) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return {
        success: false,
        error: {
          type: 'migration_required',
          oldVersion: 1,
          newVersion: 2,
          message: 'API version retired, migration to v2 required',
        },
      };
    }

    const error = body as Record<string, unknown>;
    return {
      success: false,
      error: {
        type: 'migration_required',
        oldVersion: 1,
        newVersion: 2,
        message: String(error.message || 'API version retired'),
      },
    };
  }

  // Handle 422 Unprocessable Entity - unsupported scope
  if (response.status === 422) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return {
        success: false,
        error: {
          type: 'unsupported_scope',
          message: 'Requested scope not supported',
        },
      };
    }

    const error = body as Record<string, unknown>;
    return {
      success: false,
      error: {
        type: 'unsupported_scope',
        message: String(error.message || 'Requested scope not supported'),
      },
    };
  }

  // Handle other errors
  if (!response.ok) {
    let message = `Service error: ${response.status}`;
    try {
      const body = await response.json();
      message = (body as Record<string, unknown>).message as string || message;
    } catch {
      // Use default message
    }

    return {
      success: false,
      error: {
        type: 'unavailable',
        reason: 'service_error',
        message,
      },
    };
  }

  // Parse response
  let data: unknown;
  try {
    const text = await response.text();

    // Check for HTML response (common error case)
    if (text.trim().startsWith('<')) {
      return {
        success: false,
        error: {
          type: 'invalid_response',
          message: 'Received HTML response instead of JSON',
        },
      };
    }

    data = JSON.parse(text);
  } catch (error) {
    return {
      success: false,
      error: {
        type: 'invalid_response',
        message: `Failed to parse JSON response: ${error instanceof Error ? error.message : 'unknown error'}`,
      },
    };
  }

  // Validate schema version
  if (!validateSchemaVersion(data)) {
    return {
      success: false,
      error: {
        type: 'invalid_response',
        message: 'Missing or invalid schemaVersion (expected 2)',
      },
    };
  }

  return { success: true, data: data as T };
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export async function getDay(params: {
  date: string;
  lat?: number;
  lon?: number;
  elevation?: number;
  tz?: string;
  place?: string;
}): Promise<PanchangResult<DayResolution>> {
  // Check configuration
  if (!isConfigured()) {
    return {
      success: false,
      error: {
        type: 'unavailable',
        reason: 'not_configured',
        message: 'Panchang service URL not configured',
      },
    };
  }

  // Validate inputs
  if (!validateDate(params.date)) {
    return {
      success: false,
      error: {
        type: 'invalid_input',
        message: 'Invalid date format (expected YYYY-MM-DD)',
      },
    };
  }

  if (params.tz && !validateTimezone(params.tz)) {
    return {
      success: false,
      error: {
        type: 'invalid_input',
        message: 'Invalid timezone',
      },
    };
  }

  if (params.place && !validateLocationKey(params.place)) {
    return {
      success: false,
      error: {
        type: 'invalid_input',
        message: 'Invalid place key',
      },
    };
  }

  // Build URL
  const url = new URL(`${PANCHANG_SERVICE_URL}/v2/day/iskcon/${params.date}`);

  if (params.place) {
    url.searchParams.set('place', params.place);
  } else {
    if (params.lat !== undefined) url.searchParams.set('lat', String(params.lat));
    if (params.lon !== undefined) url.searchParams.set('lon', String(params.lon));
    if (params.elevation !== undefined) url.searchParams.set('elevation', String(params.elevation));
    if (params.tz) url.searchParams.set('tz', params.tz);
  }

  // Make request
  try {
    const response = await fetchWithTimeout(url.toString(), PANCHANG_REQUEST_TIMEOUT_MS);
    const result = await handlePanchangResponse<DayResolution>(response);

    if (!result.success) return result;

    // Validate publication structures
    const data = result.data;
    if (!validatePublication(data.ekadashiYear.publication) || !validatePublication(data.yearResolution.publication)) {
      return {
        success: false,
        error: {
          type: 'invalid_response',
          message: 'Invalid publication structure',
        },
      };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        type: 'unavailable',
        reason: error instanceof Error && error.message === 'Request timeout' ? 'timeout' : 'network_error',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    };
  }
}

export async function getCalendar(params: {
  year: number;
  lat?: number;
  lon?: number;
  elevation?: number;
  tz?: string;
  place?: string;
}): Promise<PanchangResult<CalendarYear>> {
  // Check configuration
  if (!isConfigured()) {
    return {
      success: false,
      error: {
        type: 'unavailable',
        reason: 'not_configured',
        message: 'Panchang service URL not configured',
      },
    };
  }

  // Validate inputs
  if (!validateYear(params.year)) {
    return {
      success: false,
      error: {
        type: 'invalid_input',
        message: 'Invalid year (expected 2000-2100)',
      },
    };
  }

  if (params.tz && !validateTimezone(params.tz)) {
    return {
      success: false,
      error: {
        type: 'invalid_input',
        message: 'Invalid timezone',
      },
    };
  }

  if (params.place && !validateLocationKey(params.place)) {
    return {
      success: false,
      error: {
        type: 'invalid_input',
        message: 'Invalid place key',
      },
    };
  }

  // Build URL
  const url = new URL(`${PANCHANG_SERVICE_URL}/v2/calendar/iskcon/${params.year}`);

  if (params.place) {
    url.searchParams.set('place', params.place);
  } else {
    if (params.lat !== undefined) url.searchParams.set('lat', String(params.lat));
    if (params.lon !== undefined) url.searchParams.set('lon', String(params.lon));
    if (params.elevation !== undefined) url.searchParams.set('elevation', String(params.elevation));
    if (params.tz) url.searchParams.set('tz', params.tz);
  }

  // Make request
  try {
    const response = await fetchWithTimeout(url.toString(), PANCHANG_REQUEST_TIMEOUT_MS);
    const result = await handlePanchangResponse<CalendarYear>(response);

    if (!result.success) return result;

    // Validate publication structures
    const data = result.data;
    if (!validatePublication(data.ekadashiYear.publication) || !validatePublication(data.yearResolution.publication)) {
      return {
        success: false,
        error: {
          type: 'invalid_response',
          message: 'Invalid publication structure',
        },
      };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: {
        type: 'unavailable',
        reason: error instanceof Error && error.message === 'Request timeout' ? 'timeout' : 'network_error',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    };
  }
}

export async function getPlaces(): Promise<PanchangResult<PanchangPlace[]>> {
  if (!isConfigured()) {
    return {
      success: false,
      error: {
        type: 'unavailable',
        reason: 'not_configured',
        message: 'Panchang service URL not configured',
      },
    };
  }

  const url = `${PANCHANG_SERVICE_URL}/v2/places`;

  try {
    const response = await fetchWithTimeout(url, PANCHANG_REQUEST_TIMEOUT_MS);

    if (!response.ok) {
      return {
        success: false,
        error: {
          type: 'unavailable',
          reason: 'service_error',
          message: `Service error: ${response.status}`,
        },
      };
    }

    const data = await response.json();
    return { success: true, data: data as PanchangPlace[] };
  } catch (error) {
    return {
      success: false,
      error: {
        type: 'unavailable',
        reason: error instanceof Error && error.message === 'Request timeout' ? 'timeout' : 'network_error',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    };
  }
}

export function isServiceConfigured(): boolean {
  return isConfigured();
}

/**
 * Extract guidance that is approved and available.
 * Returns null if guidance is withheld, [] if approved with no items.
 */
export function extractApprovedObservances(resolution: DayResolution | CalendarYear): Observance[] | null {
  const pub = resolution.ekadashiYear.publication;
  if (!isGuidanceAvailable(pub)) return null;
  return resolution.observances;
}

export function extractApprovedEvents(resolution: DayResolution | CalendarYear): Event[] | null {
  const pub = resolution.yearResolution.publication;
  if (!isGuidanceAvailable(pub)) return null;
  return resolution.events;
}

export function getUnavailabilityReason(publication: Publication): string | null {
  if (isGuidanceAvailable(publication)) return null;

  switch (publication.state) {
    case 'PENDING_REVIEW':
      return 'Awaiting qualified review';
    case 'DISPUTED':
      return 'Under review - guidance temporarily unavailable';
    case 'REVOKED':
      return 'Previously approved guidance has been revoked';
    case 'UNAVAILABLE':
      return 'Not available for this location/time';
    default:
      if (publication.guidance === 'WITHHELD') {
        return 'Guidance withheld pending approval';
      }
      return 'Guidance not available';
  }
}
