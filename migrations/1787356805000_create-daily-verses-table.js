/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Editorial selections for the app's Verse of the Day.
 *
 * The verse text remains in scripture_verses. This table only adds the small amount of
 * product-specific metadata needed to curate a trusted daily reflection without duplicating
 * or silently changing the underlying scripture.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.createTable('daily_verses', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    verse_id: {
      type: 'uuid',
      notNull: true,
      references: 'scripture_verses',
      onDelete: 'CASCADE',
    },
    theme: {
      type: 'varchar(64)',
      notNull: true,
    },
    reflection: {
      type: 'text',
      notNull: true,
    },
    translation_override: {
      type: 'text',
    },
    locale: {
      type: 'varchar(16)',
      notNull: true,
      default: 'en',
    },
    display_date: {
      type: 'date',
    },
    priority: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
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

  pgm.addConstraint('daily_verses', 'daily_verses_locale_valid', {
    check: "locale ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'",
  });
  pgm.addConstraint('daily_verses', 'daily_verses_priority_bounded', {
    check: 'priority BETWEEN 0 AND 100',
  });
  pgm.addConstraint('daily_verses', 'daily_verses_reflection_not_blank', {
    check: "length(btrim(reflection)) >= 12",
  });

  pgm.createIndex('daily_verses', ['is_active', 'locale', 'display_date']);
  pgm.createIndex('daily_verses', 'verse_id');
  pgm.sql(`
    CREATE UNIQUE INDEX daily_verses_one_scheduled_per_locale
      ON daily_verses (display_date, locale)
      WHERE display_date IS NOT NULL
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('daily_verses');
};
