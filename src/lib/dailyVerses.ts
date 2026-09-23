import { isIsoDate } from './datedEvents.ts';

export const DAILY_VERSE_THEMES = [
  'Trust',
  'Surrender',
  'Bhakti',
  'Remembrance',
  'Seva',
  'Courage',
  'Detachment',
  'Compassion',
  'Peace',
  'Dharma',
  'Gratitude',
  'Humility',
] as const;

export interface DailyVerseInput {
  scriptureId?: unknown;
  canto?: unknown;
  chapter?: unknown;
  verse?: unknown;
  theme?: unknown;
  reflection?: unknown;
  translationOverride?: unknown;
  translationLocale?: unknown;
  locale?: unknown;
  displayDate?: unknown;
  priority?: unknown;
  isActive?: unknown;
}

export interface DailyVerseFields {
  scriptureId: string;
  canto: number | null;
  chapter: number;
  verse: number;
  theme: string;
  reflection: string;
  translationOverride: string | null;
  translationLocale: string;
  locale: string;
  displayDate: string | null;
  priority: number;
  isActive: boolean;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const integer = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

export function isSupportedLocale(value: unknown): value is string {
  if(typeof value!=='string'||value.length>16||!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(value))return false;
  try{return Intl.getCanonicalLocales(value).length===1;}catch{return false;}
}

export function validateDailyVerse(input: DailyVerseInput): ValidationResult<DailyVerseFields> {
  const errors: string[] = [];
  const scriptureId = text(input.scriptureId);
  const canto = integer(input.canto);
  const chapter = integer(input.chapter);
  const verse = integer(input.verse);
  const theme = text(input.theme);
  const reflection = text(input.reflection);
  const translationOverride = text(input.translationOverride) || null;
  const rawLocale = text(input.locale) || 'en';
  const locale = isSupportedLocale(rawLocale)?Intl.getCanonicalLocales(rawLocale)[0]:rawLocale;
  const rawTranslationLocale=text(input.translationLocale)||'en';
  const translationLocale=isSupportedLocale(rawTranslationLocale)?Intl.getCanonicalLocales(rawTranslationLocale)[0]:rawTranslationLocale;
  const displayDate = text(input.displayDate) || null;
  const priority = integer(input.priority) ?? 0;
  const isActive = typeof input.isActive === 'boolean'
    ? input.isActive
    : input.isActive === undefined || input.isActive === null || input.isActive === 'true';

  if (!/^[a-z0-9][a-z0-9_]*$/.test(scriptureId)) {
    errors.push('A valid scripture id is required.');
  }
  if (canto !== null && canto <= 0) errors.push('Canto must be a positive whole number.');
  if (chapter === null || chapter <= 0) errors.push('Chapter must be a positive whole number.');
  if (verse === null || verse <= 0) errors.push('Verse must be a positive whole number.');
  if (!DAILY_VERSE_THEMES.includes(theme as typeof DAILY_VERSE_THEMES[number])) {
    errors.push(`Theme must be one of: ${DAILY_VERSE_THEMES.join(', ')}.`);
  }
  if (reflection.length < 12 || reflection.length>10000) errors.push('Reflection must contain 12–10,000 characters.');
  if(translationOverride && translationOverride.length>20000)errors.push('Translation is too long.');
  if (!isSupportedLocale(locale)) errors.push('Locale must be a language tag such as en or hi-IN.');
  if (!isSupportedLocale(translationLocale)) errors.push('Translation language must be a language tag such as en or hi.');
  if (displayDate !== null && !isIsoDate(displayDate)) {
    errors.push('Display date must be a real YYYY-MM-DD date.');
  }
  if (priority < 0 || priority > 100) errors.push('Priority must be between 0 and 100.');

  if (errors.length > 0 || chapter === null || verse === null) return { ok: false, errors };
  return {
    ok: true,
    value: {
      scriptureId,
      canto,
      chapter,
      verse,
      theme,
      reflection,
      translationOverride,
      translationLocale,
      locale,
      displayDate,
      priority,
      isActive,
    },
  };
}

export interface DailyVerseJoinedRow {
  id: string;
  scripture_id: string;
  scripture_title: string;
  ref_prefix: string | null;
  canto: number | null;
  chapter: number;
  verse: number;
  sanskrit: string | null;
  iast: string | null;
  translation: string | null;
  theme: string;
  reflection: string;
  translation_override: string | null;
  locale: string;
  display_date: string | null;
  priority: number;
  is_scheduled?: boolean;
}

export function toDailyVersePayload(row: DailyVerseJoinedRow, requestedDate: string) {
  const numericRef = `${row.canto ? `${row.canto}.` : ''}${row.chapter}.${row.verse}`;
  return {
    id: row.id,
    date: requestedDate,
    scriptureId: row.scripture_id,
    scriptureTitle: row.scripture_title,
    reference: `${row.ref_prefix || row.scripture_id} ${numericRef}`,
    canto: row.canto,
    chapter: row.chapter,
    verse: row.verse,
    sanskrit: row.sanskrit ?? '',
    transliteration: row.iast ?? '',
    translation: row.translation_override || row.translation || '',
    reflection: row.reflection,
    theme: row.theme,
    locale: row.locale,
    scheduled: row.is_scheduled ?? row.display_date !== null,
  };
}

/** Stable across processes and platforms; used only to choose a row from the unscheduled pool. */
export function stableDailyIndex(date: string, size: number): number {
  if (size <= 0) return 0;
  const epochDay = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return Number.isFinite(epochDay) ? ((epochDay % size) + size) % size : 0;
}
