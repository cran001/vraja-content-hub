/**
 * Scripture hosting: validation and row → API mapping shared by the public endpoints, the
 * admin CRUD endpoints and the admin UI.
 *
 * Two schemas meet here:
 *   • the catalogue entry (camelCase) served by GET /api/v1/scriptures
 *   • the verse object (snake_case) served by GET /api/v1/scriptures/{id}, which mirrors the
 *     app's bundled scripture_verses asset format verbatim
 *
 * Client-safe: no database access and no Node-only APIs.
 */

// ─────────────────────────────────────────────────────────────
// Catalogue
// ─────────────────────────────────────────────────────────────

/** Suggested categories. Free-form — the app just groups the library by whatever it is given. */
export const SCRIPTURE_CATEGORIES = [
  'Upanishad',
  'Stotra',
  'Purana',
  'Itihasa',
  'Gita',
  'Samhita',
  'Other',
] as const;

const SLUG = /^[a-z0-9][a-z0-9_]*$/;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

/** True for the lowercase snake_case slug used as the scripture id, e.g. "nrsimha_tapani". */
export function isScriptureSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 100 && SLUG.test(value);
}

/** Turns a title into a candidate slug: "Nṛsiṁha Tāpanī" → "nrsimha_tapani". */
export function slugifyScriptureId(title: string): string {
  return title
    // NFD splits an IAST letter into base + combining mark; dropping the marks folds
    // "Nṛsiṁha Tāpanī" down to "nrsimha tapani".
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

export interface ScriptureInput {
  id?: string | null;
  title?: string | null;
  titleHi?: string | null;
  description?: string | null;
  category?: string | null;
  colorHex?: string | null;
  refPrefix?: string | null;
  hasCantos?: boolean;
  declaredVerseCount?: number | string | null;
  sortOrder?: number | string | null;
  isActive?: boolean;
}

export interface ScriptureFields {
  id: string;
  title: string;
  titleHi: string | null;
  description: string | null;
  category: string | null;
  colorHex: string | null;
  refPrefix: string | null;
  hasCantos: boolean;
  declaredVerseCount: number | null;
  sortOrder: number;
  isActive: boolean;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

const trimOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toIntOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isInteger(parsed) ? parsed : null;
};

/** Validates a catalogue entry. `requireId` is false for updates, where the id comes from the URL. */
export function validateScripture(
  input: ScriptureInput,
  { requireId = true }: { requireId?: boolean } = {},
): ValidationResult<ScriptureFields> {
  const errors: string[] = [];

  const title = trimOrNull(input.title);
  if (!title) errors.push('Title is required.');
  else if (title.length > 255) errors.push('Title must be 255 characters or fewer.');

  const rawId = trimOrNull(input.id);
  const id = rawId ?? (title ? slugifyScriptureId(title) : null);
  if (requireId && !id) {
    errors.push('Scripture id is required.');
  } else if (id && !isScriptureSlug(id)) {
    errors.push('Scripture id must be lowercase letters, digits and underscores, e.g. "nrsimha_tapani".');
  }

  const titleHi = trimOrNull(input.titleHi);
  if (titleHi && titleHi.length > 255) errors.push('Hindi title must be 255 characters or fewer.');

  const category = trimOrNull(input.category);
  if (category && category.length > 100) errors.push('Category must be 100 characters or fewer.');

  const colorHex = trimOrNull(input.colorHex);
  if (colorHex && !HEX_COLOR.test(colorHex)) {
    errors.push('Colour must be a hex value like #7C6AF7.');
  }

  const refPrefix = trimOrNull(input.refPrefix);
  if (refPrefix && refPrefix.length > 16) errors.push('Reference prefix must be 16 characters or fewer.');

  const declaredVerseCount = toIntOrNull(input.declaredVerseCount);
  if (input.declaredVerseCount !== null && input.declaredVerseCount !== undefined &&
      input.declaredVerseCount !== '' && declaredVerseCount === null) {
    errors.push('Declared verse count must be a whole number.');
  } else if (declaredVerseCount !== null && declaredVerseCount < 0) {
    errors.push('Declared verse count cannot be negative.');
  }

  const sortOrder = toIntOrNull(input.sortOrder) ?? 0;

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      id: (id ?? '') as string,
      title: title as string,
      titleHi,
      description: trimOrNull(input.description),
      category,
      colorHex,
      refPrefix,
      hasCantos: input.hasCantos === true,
      declaredVerseCount,
      sortOrder,
      isActive: input.isActive !== false,
    },
  };
}

/** A `scriptures` row joined with its live verse count. */
export interface ScriptureRow {
  id: string;
  title: string;
  title_hi: string | null;
  description: string | null;
  category: string | null;
  color_hex: string | null;
  version: number;
  ref_prefix: string | null;
  has_cantos: boolean;
  declared_verse_count: number | null;
  verse_count: number;
  sort_order?: number;
  is_active?: boolean;
}

export interface ScripturePayload {
  id: string;
  title: string;
  titleHi?: string;
  description?: string;
  category?: string;
  colorHex?: string;
  verseCount: number;
  version: number;
  refPrefix?: string;
  hasCantos: boolean;
}

/**
 * Maps a catalogue row to the public payload.
 *
 * verseCount is the ACTUAL number of stored verses, never the editor's declared figure — the
 * app shows it before downloading, so it has to match what the download will contain.
 */
export function toScripturePayload(row: ScriptureRow): ScripturePayload {
  const payload: ScripturePayload = {
    id: row.id,
    title: row.title,
    verseCount: Number(row.verse_count) || 0,
    version: Number(row.version) || 1,
    hasCantos: row.has_cantos === true,
  };
  if (row.title_hi) payload.titleHi = row.title_hi;
  if (row.description) payload.description = row.description;
  if (row.category) payload.category = row.category;
  if (row.color_hex) payload.colorHex = row.color_hex;
  if (row.ref_prefix) payload.refPrefix = row.ref_prefix;
  return payload;
}

// ─────────────────────────────────────────────────────────────
// Verses
// ─────────────────────────────────────────────────────────────

export interface WordForWord {
  word: string;
  meaning: string;
}

/** One verse, ready to store. Field names match the public JSON exactly. */
export interface VerseFields {
  canto: number | null;
  chapter: number;
  verse: number;
  chapter_title: string | null;
  sanskrit: string;
  iast: string;
  translation: string;
  purport: string | null;
  word_for_word: WordForWord[] | null;
  puranic_story: Record<string, unknown> | null;
  image_prompt: string | null;
}

/**
 * Attribution markers retained for import diagnostics. Their presence or absence does not
 * establish distribution permission. The publishing workflow requires reviewed evidence.
 */
const COPYRIGHT_MARKERS = [
  'bhaktivedanta book trust',
  'bhaktivedanta boook trust',
  'bbti',
  '© bbt',
  '(c) bbt',
  'bbt international',
  'a.c. bhaktivedanta swami',
  'ac bhaktivedanta swami',
  'srila prabhupada',
  'śrīla prabhupāda',
  'prabhupada purport',
  'as it is, translation by his divine grace',
];

/**
 * Scans the payload for copyrighted-translation attribution. Returns the marker it found, or
 * null when the text looks clear.
 *
 * This is a guard against the obvious mistake — pasting a BBT export — not a licence audit. The
 * editor is still responsible for the provenance of what they upload.
 */
export function findCopyrightMarker(haystack: string): string | null {
  const lower = haystack.toLowerCase();
  for (const marker of COPYRIGHT_MARKERS) {
    if (lower.includes(marker)) return marker;
  }
  return null;
}

const asPlainString = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/** Reads a key in camelCase or snake_case, so hand-authored JSON in either style loads. */
function pick(obj: Record<string, unknown>, camel: string, snake: string): unknown {
  if (obj[camel] !== undefined && obj[camel] !== null) return obj[camel];
  if (obj[snake] !== undefined && obj[snake] !== null) return obj[snake];
  return undefined;
}

function parseWordForWord(value: unknown, label: string, errors: string[]): WordForWord[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    errors.push(`${label}: word_for_word must be an array of { word, meaning } objects.`);
    return null;
  }
  const pairs: WordForWord[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${label}: each word_for_word entry must be an object with word and meaning.`);
      return null;
    }
    const record = entry as Record<string, unknown>;
    const word = asPlainString(record.word);
    const meaning = asPlainString(record.meaning);
    if (!word) {
      errors.push(`${label}: a word_for_word entry is missing its word.`);
      return null;
    }
    pairs.push({ word, meaning });
  }
  return pairs.length > 0 ? pairs : null;
}

/**
 * Validates a whole verse array for one scripture.
 *
 * Rejects the two things that corrupt a reader on the device:
 *   • chapter / verse / canto numbers that are not positive integers — the app skips those rows
 *     silently, so a text would install with holes in it
 *   • duplicate verse references within the scripture, which would collide on the app's
 *     (scripture_id, chapter, verse) key
 *
 * `hasCantos` cross-checks the catalogue flag against the data so a cantoed text is not
 * published as a flat one, or vice versa.
 */
export function validateVerses(
  raw: unknown,
  { hasCantos }: { hasCantos: boolean },
): ValidationResult<VerseFields[]> {
  const errors: string[] = [];

  // Accept a bare array or { "verses": [...] }, matching what the app itself accepts.
  const array = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).verses)
      ? ((raw as Record<string, unknown>).verses as unknown[])
      : null;

  if (!array) {
    return { ok: false, errors: ['Content must be a JSON array of verses, or { "verses": [ … ] }.'] };
  }
  if (array.length === 0) {
    return { ok: false, errors: ['Content contains no verses.'] };
  }

  const verses: VerseFields[] = [];
  const seen = new Map<string, number>();

  array.forEach((entry, index) => {
    const label = `Verse #${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${label}: expected an object.`);
      return;
    }
    const obj = entry as Record<string, unknown>;

    const chapter = toIntOrNull(pick(obj, 'chapter', 'chapter'));
    const verseNum = toIntOrNull(pick(obj, 'verse', 'verse'));
    const cantoRaw = pick(obj, 'canto', 'canto');
    const canto = cantoRaw === undefined ? null : toIntOrNull(cantoRaw);

    if (chapter === null || chapter <= 0) {
      errors.push(`${label}: chapter must be a positive whole number.`);
    }
    if (verseNum === null || verseNum <= 0) {
      errors.push(`${label}: verse must be a positive whole number.`);
    }
    if (cantoRaw !== undefined && (canto === null || canto <= 0)) {
      errors.push(`${label}: canto must be a positive whole number when present.`);
    }
    if (hasCantos && cantoRaw === undefined) {
      errors.push(`${label}: this scripture is marked as having cantos, so canto is required.`);
    }
    if (!hasCantos && canto !== null && canto > 0) {
      errors.push(`${label}: canto is set, but the scripture is not marked as having cantos.`);
    }

    if (chapter === null || verseNum === null || chapter <= 0 || verseNum <= 0) return;

    const key = `${canto ?? 0}.${chapter}.${verseNum}`;
    const previous = seen.get(key);
    if (previous !== undefined) {
      errors.push(
        `${label}: duplicate reference ${key.replace(/^0\./, '')} — already used by verse #${previous}.`,
      );
      return;
    }
    seen.set(key, index + 1);

    const wordForWord = parseWordForWord(pick(obj, 'wordForWord', 'word_for_word'), label, errors);

    const storyRaw = pick(obj, 'puranicStory', 'puranic_story');
    let puranicStory: Record<string, unknown> | null = null;
    if (storyRaw !== undefined) {
      if (typeof storyRaw === 'object' && storyRaw !== null && !Array.isArray(storyRaw)) {
        puranicStory = storyRaw as Record<string, unknown>;
      } else {
        errors.push(`${label}: puranic_story must be an object.`);
      }
    }

    verses.push({
      canto: canto && canto > 0 ? canto : null,
      chapter,
      verse: verseNum,
      chapter_title: asPlainString(pick(obj, 'chapterTitle', 'chapter_title')) || null,
      sanskrit: asPlainString(pick(obj, 'sanskrit', 'sanskrit')),
      iast: asPlainString(pick(obj, 'iast', 'transliteration')),
      translation: asPlainString(pick(obj, 'translation', 'translation')),
      purport: asPlainString(pick(obj, 'purport', 'commentary')) || null,
      word_for_word: wordForWord,
      puranic_story: puranicStory,
      image_prompt: asPlainString(pick(obj, 'imagePrompt', 'image_prompt')) || null,
    });
  });

  // Cap the error list: a malformed 700-verse paste would otherwise produce a wall of text.
  if (errors.length > 0) {
    const shown = errors.slice(0, 25);
    if (errors.length > shown.length) {
      shown.push(`… and ${errors.length - shown.length} more problem(s).`);
    }
    return { ok: false, errors: shown };
  }

  return { ok: true, value: verses };
}

/** A `scripture_verses` row as `pg` hands it back. */
export interface VerseRow {
  canto: number | null;
  chapter: number;
  verse: number;
  chapter_title: string | null;
  sanskrit: string | null;
  iast: string | null;
  translation: string | null;
  purport: string | null;
  word_for_word: WordForWord[] | null;
  puranic_story: Record<string, unknown> | null;
  image_prompt: string | null;
}

/**
 * Maps a verse row to the public JSON. Keys stay snake_case to match the app's bundled asset
 * schema, and optional fields are omitted rather than sent as null so the payload stays small
 * across a few thousand verses.
 */
export function toVersePayload(row: VerseRow): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    chapter: row.chapter,
    verse: row.verse,
    sanskrit: row.sanskrit ?? '',
    iast: row.iast ?? '',
    translation: row.translation ?? '',
  };
  if (row.canto !== null && row.canto !== undefined) payload.canto = row.canto;
  if (row.chapter_title) payload.chapter_title = row.chapter_title;
  if (row.purport) payload.purport = row.purport;
  if (row.word_for_word && row.word_for_word.length > 0) payload.word_for_word = row.word_for_word;
  if (row.puranic_story) payload.puranic_story = row.puranic_story;
  if (row.image_prompt) payload.image_prompt = row.image_prompt;
  return payload;
}
