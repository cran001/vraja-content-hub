/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Dated events are the calendar entries the Android app reads from
 * GET /api/v1/events/dated?from=…&to=… — festivals, Ekadashi fasts, appearance and
 * disappearance days, and other observances tied to one specific date.
 *
 * Parana (fast-breaking) timing is the delicate part. The app renders one of exactly
 * two shapes and mis-renders anything in between, so the shape is enforced here in the
 * database rather than trusted to callers:
 *
 *   window — parana_date + parana_start_time + parana_end_time, parana_type = 'window'
 *            → "Parana: 06:12 - 10:50"
 *   after  — parana_date + parana_start_time, NO end time, parana_type = 'after'
 *            → "Parana after 10:50"  (Hari Vasara ends past one-third of daylight)
 *
 * A start time without either an end time or 'after' is a half-specified window and is
 * rejected by dated_events_parana_shape. event_type is deliberately NOT constrained here:
 * the six-value vocabulary is validated in the API layer (src/lib/datedEvents.ts) so it
 * can grow without a migration, while the parana invariant — which breaks the consumer
 * when violated — is locked down in the schema.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.createTable('dated_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    title: {
      type: 'varchar(255)',
      notNull: true,
    },
    // Hindi title, shown by the app when the device is set to Hindi
    title_hi: {
      type: 'varchar(255)',
    },
    // Festival | Ekadashi | Appearance | Disappearance | Parana | Special Observance
    event_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    // The day the event falls on (never NULL — this is what "dated" means here)
    event_date: {
      type: 'date',
      notNull: true,
    },
    description: {
      type: 'text',
      notNull: true,
      default: '',
    },
    fasting_guidelines: {
      type: 'text',
    },
    // Usually the day AFTER event_date for an Ekadashi fast
    parana_date: {
      type: 'date',
    },
    parana_start_time: {
      type: 'time without time zone',
    },
    // NULL for the 'after' shape — the fast may only be broken past parana_start_time
    parana_end_time: {
      type: 'time without time zone',
    },
    parana_type: {
      type: 'varchar(10)',
    },
    // Free-form time bound for non-fasting timed events, e.g. "05:30 - 06:15"
    time_slot: {
      type: 'varchar(100)',
    },
    is_major_event: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    // Cloudinary asset for the event banner (optional)
    image_public_id: {
      type: 'varchar(255)',
    },
    image_url: {
      type: 'text',
    },
    details_url: {
      type: 'text',
    },
    author_id: {
      type: 'uuid',
      references: 'admins',
      onDelete: 'SET NULL',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // A time is meaningless without the day it lands on
  pgm.addConstraint('dated_events', 'dated_events_parana_needs_date', {
    check: 'parana_start_time IS NULL OR parana_date IS NOT NULL',
  });

  // An end time alone would leave the window open at the front
  pgm.addConstraint('dated_events', 'dated_events_parana_end_needs_start', {
    check: 'parana_end_time IS NULL OR parana_start_time IS NOT NULL',
  });

  pgm.addConstraint('dated_events', 'dated_events_parana_type_valid', {
    check: "parana_type IS NULL OR parana_type IN ('window', 'after')",
  });

  pgm.addConstraint('dated_events', 'dated_events_parana_type_needs_start', {
    check: 'parana_type IS NULL OR parana_start_time IS NOT NULL',
  });

  // The core invariant: a start time is always paired with an end time (window) or
  // flagged 'after'. Parana windows are morning windows and never cross midnight,
  // so end > start holds unconditionally.
  //
  // parana_type is compared through COALESCE deliberately. A bare `parana_type = 'after'`
  // yields NULL rather than false when the column is NULL, and a CHECK constraint is
  // satisfied by NULL — so the one row this constraint exists to reject (a start time with
  // no end time and no type) would slip straight through. COALESCE keeps the comparison
  // two-valued so every branch is a real true/false.
  pgm.addConstraint('dated_events', 'dated_events_parana_shape', {
    check: `
      parana_start_time IS NULL
      OR (parana_end_time IS NOT NULL
          AND parana_end_time > parana_start_time
          AND COALESCE(parana_type, '') = 'window')
      OR (parana_end_time IS NULL AND COALESCE(parana_type, '') = 'after')
    `,
  });

  // The public endpoint only ever asks "active events between two dates"
  pgm.createIndex('dated_events', ['is_active', 'event_date']);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.dropTable('dated_events');
};
