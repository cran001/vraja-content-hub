/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Verses of a scripture, served verbatim (snake_case) by GET /api/v1/scriptures/{id} to match
 * the app's bundled scripture_verses asset schema. Deleting a scripture removes its verses.
 *
 * Uniqueness is per (scripture_id, canto, chapter, verse). Cantoless texts store canto NULL,
 * so the unique index folds NULL to 0 — in Postgres two NULLs are distinct, which would
 * otherwise let the same chapter/verse be inserted twice for a cantoless scripture.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.createTable('scripture_verses', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    scripture_id: {
      type: 'varchar(100)',
      notNull: true,
      references: 'scriptures',
      onDelete: 'CASCADE',
    },
    // NULL for texts without cantos (Gita, most stotras)
    canto: {
      type: 'integer',
    },
    chapter: {
      type: 'integer',
      notNull: true,
    },
    verse: {
      type: 'integer',
      notNull: true,
    },
    chapter_title: {
      type: 'varchar(255)',
    },
    // Devanagari
    sanskrit: {
      type: 'text',
      notNull: true,
      default: '',
    },
    // IAST transliteration
    iast: {
      type: 'text',
      notNull: true,
      default: '',
    },
    translation: {
      type: 'text',
      notNull: true,
      default: '',
    },
    // Public-domain commentary only — served to the app as "purport"
    purport: {
      type: 'text',
    },
    // [{ "word": "…", "meaning": "…" }, …]
    word_for_word: {
      type: 'jsonb',
    },
    // { "title": "…", "story": "…", … } — free-form object the app passes through
    puranic_story: {
      type: 'jsonb',
    },
    image_prompt: {
      type: 'text',
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

  // The app skips any verse with chapter <= 0 or verse <= 0, so never store one
  pgm.addConstraint('scripture_verses', 'scripture_verses_chapter_positive', {
    check: 'chapter > 0',
  });
  pgm.addConstraint('scripture_verses', 'scripture_verses_verse_positive', {
    check: 'verse > 0',
  });
  pgm.addConstraint('scripture_verses', 'scripture_verses_canto_positive', {
    check: 'canto IS NULL OR canto > 0',
  });

  // One row per verse reference, and the reading order the API serves rows in
  pgm.sql(`
    CREATE UNIQUE INDEX scripture_verses_ref_unique
      ON scripture_verses (scripture_id, COALESCE(canto, 0), chapter, verse)
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.dropTable('scripture_verses');
};
