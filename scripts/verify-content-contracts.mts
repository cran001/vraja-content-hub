/**
 * Contract checks for the dated-events and scripture libraries — no database, no server.
 *
 *   node scripts/verify-content-contracts.mts
 *
 * These pin the parana display rules, which are the part of the API the Android app cannot
 * recover from if it is wrong: a half-specified window renders as a broken or misleading timing
 * on the home feed. Node ≥ 22.6 runs this directly (type stripping); the file is a `.mts` so
 * `tsc --noEmit` over the Next project leaves it alone.
 */

import {
  toDatedEventPayload,
  validateDatedEvent,
  type DatedEventRow,
} from '../src/lib/datedEvents.ts';
import {
  findCopyrightMarker,
  slugifyScriptureId,
  toScripturePayload,
  validateVerses,
} from '../src/lib/scriptures.ts';
import {
  stableDailyIndex,
  toDailyVersePayload,
  validateDailyVerse,
} from '../src/lib/dailyVerses.ts';

let failures = 0;
const check = (name: string, condition: boolean) => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}`);
  if (!condition) failures++;
};

const row = (over: Partial<DatedEventRow>): DatedEventRow => ({
  id: 'id',
  title: 'Event',
  title_hi: null,
  event_type: 'Ekadashi',
  event_date: '2026-05-27',
  description: '',
  fasting_guidelines: null,
  parana_date: null,
  parana_start_time: null,
  parana_end_time: null,
  parana_type: null,
  time_slot: null,
  is_major_event: false,
  image_url: null,
  details_url: null,
  ...over,
});

console.log('\n── Parana rule 1: a normal window ──');
const window_ = validateDatedEvent({
  title: 'Pandava Nirjala Ekadashi',
  eventType: 'Ekadashi',
  date: '2026-05-27',
  paranaStartTime: '05:24',
  paranaEndTime: '08:12',
});
check('validates', window_.ok);
check("type is inferred as 'window'", window_.ok && window_.value.paranaType === 'window');
check('parana date defaults to the day after the fast', window_.ok && window_.value.paranaDate === '2026-05-28');

const windowPayload = toDatedEventPayload(row({
  parana_date: '2026-05-28',
  parana_start_time: '05:24:00',
  parana_end_time: '08:12:00',
  parana_type: 'window',
}));
check(
  'payload carries date + start + end together',
  windowPayload.paranaDate === '2026-05-28'
  && windowPayload.paranaStartTime === '05:24'
  && windowPayload.paranaEndTime === '08:12',
);
check('payload omits paranaType for a window', !('paranaType' in windowPayload));

console.log('\n── Parana rule 2: the boundary case, break the fast after a time ──');
const after = validateDatedEvent({
  title: 'Utpanna Ekadashi',
  eventType: 'Ekadashi',
  date: '2026-12-05',
  paranaType: 'after',
  paranaStartTime: '10:50',
});
check('validates', after.ok);
check('has no end time', after.ok && after.value.paranaEndTime === null);

const afterPayload = toDatedEventPayload(row({
  parana_date: '2026-12-06',
  parana_start_time: '10:50:00',
  parana_end_time: null,
  parana_type: 'after',
}));
check(
  'payload sends paranaType "after" with a start and no end ("Parana after 10:50")',
  afterPayload.paranaType === 'after'
  && afterPayload.paranaStartTime === '10:50'
  && !('paranaEndTime' in afterPayload),
);

console.log('\n── Parana rule 3: never a start time on its own ──');
check(
  'start without end or "after" is rejected',
  !validateDatedEvent({ title: 'X', eventType: 'Ekadashi', date: '2026-12-05', paranaStartTime: '10:50' }).ok,
);
check(
  'end before start is rejected',
  !validateDatedEvent({
    title: 'X', eventType: 'Ekadashi', date: '2026-12-05',
    paranaStartTime: '10:50', paranaEndTime: '09:00',
  }).ok,
);
check(
  '"after" with an end time is rejected',
  !validateDatedEvent({
    title: 'X', eventType: 'Ekadashi', date: '2026-12-05',
    paranaType: 'after', paranaStartTime: '10:50', paranaEndTime: '11:00',
  }).ok,
);
check(
  'a legacy half-specified row is dropped from the payload rather than published',
  (() => {
    const payload = toDatedEventPayload(row({ parana_date: '2026-12-06', parana_start_time: '10:50:00' }));
    return !('paranaStartTime' in payload) && !('paranaDate' in payload);
  })(),
);
check(
  "paranaType 'none' clears the timing the form submitted",
  (() => {
    const cleared = validateDatedEvent({
      title: 'X', eventType: 'Festival', date: '2026-12-05',
      paranaType: 'none', paranaStartTime: '10:50', paranaEndTime: '11:00',
    });
    return cleared.ok && cleared.value.paranaStartTime === null && cleared.value.paranaType === null;
  })(),
);

console.log('\n── Event fields ──');
check(
  'an unknown event type is rejected',
  !validateDatedEvent({ title: 'X', eventType: 'Kirtan', date: '2026-12-05' }).ok,
);
check(
  'an impossible date is rejected',
  !validateDatedEvent({ title: 'X', eventType: 'Festival', date: '2026-02-30' }).ok,
);
check(
  'a details URL must be http(s)',
  !validateDatedEvent({
    title: 'X', eventType: 'Festival', date: '2026-12-05', detailsUrl: 'vraja://event',
  }).ok,
);

console.log('\n── Scriptures ──');
check(
  'the id slug folds IAST diacritics',
  slugifyScriptureId('Nṛsiṁha Tāpanī Upaniṣad') === 'nrsimha_tapani_upanisad',
);
check('a bare verse array is accepted', validateVerses(
  [{ chapter: 1, verse: 1, sanskrit: 'a', iast: 'b', translation: 'c' }], { hasCantos: false },
).ok);
check('{ verses: [...] } is accepted', validateVerses(
  { verses: [{ chapter: 1, verse: 1 }] }, { hasCantos: false },
).ok);
check('chapter 0 is rejected', !validateVerses([{ chapter: 0, verse: 1 }], { hasCantos: false }).ok);
check('a negative verse is rejected', !validateVerses([{ chapter: 1, verse: -2 }], { hasCantos: false }).ok);
check('a duplicate reference is rejected', !validateVerses(
  [{ chapter: 1, verse: 1 }, { chapter: 1, verse: 1 }], { hasCantos: false },
).ok);
check('a duplicate canto reference is rejected', !validateVerses(
  [{ canto: 1, chapter: 2, verse: 3 }, { canto: 1, chapter: 2, verse: 3 }], { hasCantos: true },
).ok);
check('the same chapter/verse in different cantos is fine', validateVerses(
  [{ canto: 1, chapter: 2, verse: 3 }, { canto: 2, chapter: 2, verse: 3 }], { hasCantos: true },
).ok);
check('a cantoed scripture requires cantos', !validateVerses(
  [{ chapter: 1, verse: 1 }], { hasCantos: true },
).ok);
check('a flat scripture rejects cantos', !validateVerses(
  [{ canto: 1, chapter: 1, verse: 1 }], { hasCantos: false },
).ok);
check('"commentary" is read as the purport', (() => {
  const parsed = validateVerses([{ chapter: 1, verse: 1, commentary: 'note' }], { hasCantos: false });
  return parsed.ok && parsed.value[0].purport === 'note';
})());
check('word_for_word pairs survive', (() => {
  const parsed = validateVerses(
    [{ chapter: 1, verse: 1, wordForWord: [{ word: 'namaḥ', meaning: 'obeisances' }] }],
    { hasCantos: false },
  );
  return parsed.ok && parsed.value[0].word_for_word?.[0].word === 'namaḥ';
})());
check(
  'a copyrighted attribution is caught',
  findCopyrightMarker('Translation by Srila Prabhupada') !== null,
);
check(
  'a public-domain source passes',
  findCopyrightMarker('Translated from the Sanskrit, 1897 edition') === null,
);
check('the catalogue publishes the stored count, not the declared one', toScripturePayload({
  id: 'x', title: 'T', title_hi: null, description: null, category: null, color_hex: null,
  version: 2, ref_prefix: null, has_cantos: false, declared_verse_count: 700, verse_count: 12,
}).verseCount === 12);

console.log('\n── Daily verses ──');
const daily = validateDailyVerse({
  scriptureId: 'bhagavad_gita', chapter: 2, verse: 47, theme: 'Detachment',
  reflection: 'Offer the work sincerely and leave its result with Bhagwan.', locale: 'en',
});
check('a sourced reflection validates', daily.ok);
check('an impossible scheduled date is rejected', !validateDailyVerse({
  scriptureId: 'bhagavad_gita', chapter: 2, verse: 47, theme: 'Trust',
  reflection: 'Trust Bhagwan while doing the work before you.', displayDate: '2026-02-30',
}).ok);
check('an unknown theme is rejected', !validateDailyVerse({
  scriptureId: 'bhagavad_gita', chapter: 2, verse: 47, theme: 'Motivation',
  reflection: 'Trust Bhagwan while doing the work before you.',
}).ok);
check('daily pool selection is deterministic', stableDailyIndex('2026-09-05', 30) === stableDailyIndex('2026-09-05', 30));
check('daily payload carries an exact reference and selected date', (() => {
  const payload = toDailyVersePayload({
    id: 'daily', scripture_id: 'bhagavad_gita', scripture_title: 'Bhagavad Gita',
    ref_prefix: 'BG', canto: null, chapter: 2, verse: 47, sanskrit: 'कर्मण्येवाधिकारस्ते',
    iast: 'karmaṇy evādhikāras te', translation: 'To work alone you have the right.',
    theme: 'Detachment', reflection: 'Do the duty and entrust its result to Bhagwan.',
    translation_override: null, locale: 'en', display_date: null, priority: 0,
  }, '2026-09-05');
  return payload.reference === 'BG 2.47' && payload.date === '2026-09-05';
})());

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
