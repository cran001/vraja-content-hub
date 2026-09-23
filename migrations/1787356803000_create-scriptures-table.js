/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * The scripture catalogue served by GET /api/v1/scriptures. Each row is one downloadable
 * text; its verses live in scripture_verses.
 *
 * The primary key is the app-facing slug ("nrsimha_tapani") rather than a UUID, because the
 * Android app uses it as the local scripture_id for installed verses — it must be stable and
 * human-authored, not generated.
 *
 * declared_verse_count is what the editor claims the source text contains. The public API
 * never serves it: verseCount there is always COUNT(*) over scripture_verses, so the app is
 * told what it will actually receive. The admin UI shows declared vs actual side by side so a
 * truncated upload is obvious.
 *
 * IMPORTANT: only public-domain texts belong here. BBT / BBTI / Prabhupada translations and
 * purports are under copyright — src/lib/scriptures.ts rejects payloads carrying their
 * attribution markers.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.createTable('scriptures', {
    // Slug, e.g. "nrsimha_tapani" — doubles as the app's local scripture_id
    id: {
      type: 'varchar(100)',
      primaryKey: true,
    },
    title: {
      type: 'varchar(255)',
      notNull: true,
    },
    title_hi: {
      type: 'varchar(255)',
    },
    description: {
      type: 'text',
    },
    // Upanishad | Stotra | Purana | …  (free-form; the app groups the library by it)
    category: {
      type: 'varchar(100)',
    },
    // #RRGGBB or #AARRGGBB accent used for the library card
    color_hex: {
      type: 'varchar(9)',
    },
    // Bumped automatically whenever the verse set changes, so installs can detect updates
    version: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    // Verse-reference prefix, e.g. "NT" → "NT 1.4". Falls back to the slug in the app.
    ref_prefix: {
      type: 'varchar(16)',
    },
    has_cantos: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    // Editor's claimed verse total — compared against COUNT(*) in the admin UI
    declared_verse_count: {
      type: 'integer',
    },
    sort_order: {
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

  // Lowercase snake_case slug — it ends up in a URL path and in the app's Room rows
  pgm.addConstraint('scriptures', 'scriptures_id_is_slug', {
    check: "id ~ '^[a-z0-9][a-z0-9_]*$'",
  });

  pgm.addConstraint('scriptures', 'scriptures_color_hex_valid', {
    check: "color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'",
  });

  pgm.addConstraint('scriptures', 'scriptures_version_positive', {
    check: 'version > 0',
  });

  pgm.addConstraint('scriptures', 'scriptures_declared_count_non_negative', {
    check: 'declared_verse_count IS NULL OR declared_verse_count >= 0',
  });

  pgm.createIndex('scriptures', 'is_active');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.dropTable('scriptures');
};
