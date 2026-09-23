/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Panchang v2 integration and lock-screen media eligibility
 *
 * This migration adds:
 * 1. Lock-screen eligibility for wallpapers (explicit editorial selection)
 * 2. Panchang service integration fields for dated events
 * 3. Enhanced location/scope metadata for calendar events
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  // Add lock-screen eligibility to wallpapers
  pgm.sql(`
    ALTER TABLE wallpapers
      ADD COLUMN lock_screen_eligible boolean NOT NULL DEFAULT false;

    COMMENT ON COLUMN wallpapers.lock_screen_eligible IS
      'Explicitly selected for lock-screen rotation by editorial team. Sponsors always rejected.';
  `);

  // Add enhanced calendar event metadata for Panchang service integration
  pgm.sql(`
    ALTER TABLE dated_events
      ADD COLUMN description_hi text,
      ADD COLUMN fasting_guidelines_hi text,
      ADD COLUMN applicability text NOT NULL DEFAULT 'global'
        CHECK (applicability IN ('global', 'tradition', 'region', 'location')),
      ADD COLUMN scope_key text,
      ADD COLUMN timing_location text,
      ADD COLUMN timing_timezone text,
      ADD COLUMN timing_source text,
      ADD COLUMN cancelled boolean NOT NULL DEFAULT false,
      ADD COLUMN panchang_event_id text,
      ADD COLUMN panchang_observance_id text;

    COMMENT ON COLUMN dated_events.description_hi IS
      'Hindi description - shown when complete Hindi title+description pair exists';
    COMMENT ON COLUMN dated_events.fasting_guidelines_hi IS
      'Hindi fasting guidance - requires complete title+description in Hindi';
    COMMENT ON COLUMN dated_events.applicability IS
      'Scope: global, tradition-specific, region-specific, or location-specific';
    COMMENT ON COLUMN dated_events.scope_key IS
      'Stable identifier for tradition/region/location when not global';
    COMMENT ON COLUMN dated_events.timing_location IS
      'Location key for timing - must match request location exactly';
    COMMENT ON COLUMN dated_events.timing_timezone IS
      'IANA timezone for timing - must match request timezone exactly';
    COMMENT ON COLUMN dated_events.timing_source IS
      'Source of timing calculation/authority';
    COMMENT ON COLUMN dated_events.cancelled IS
      'Event cancelled/withdrawn - removes from public responses';
    COMMENT ON COLUMN dated_events.panchang_event_id IS
      'Panchang service event ID if linked to calculated event';
    COMMENT ON COLUMN dated_events.panchang_observance_id IS
      'Panchang service observance ID if linked to calculated observance';
  `);

  // Add indexes for new query patterns
  pgm.createIndex('dated_events', ['applicability', 'scope_key']);
  pgm.createIndex('dated_events', ['timing_location', 'timing_timezone']);
  pgm.createIndex('wallpapers', ['lock_screen_eligible'], {
    where: "lock_screen_eligible = true AND is_active = true AND publication_state = 'published'",
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  throw new Error(
    'Panchang integration migration is forward-only. Restore a verified backup if rollback is required.'
  );
};
