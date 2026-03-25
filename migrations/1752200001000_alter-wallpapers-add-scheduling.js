/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  // Add human-readable title
  pgm.addColumn('wallpapers', {
    title: { type: 'varchar(255)' },
  });

  // Content type: wallpaper | darshan | event | sponsor
  pgm.addColumn('wallpapers', {
    content_type: {
      type: 'varchar(50)',
      notNull: true,
      default: "'wallpaper'",
    },
  });

  // Deep category FK (replaces the flat category string)
  pgm.addColumn('wallpapers', {
    category_id: {
      type: 'uuid',
      references: 'categories',
      onDelete: 'SET NULL',
    },
  });

  // Time-scheduling: the date the content becomes visible
  pgm.addColumn('wallpapers', {
    visible_date: { type: 'date' },
  });

  // Time-scheduling: the date the content expires (exclusive)
  pgm.addColumn('wallpapers', {
    expires_on: { type: 'date' },
  });

  // Sponsor flag — used by the /api/v1/sponsors endpoint
  pgm.addColumn('wallpapers', {
    is_sponsor: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });

  // Author tracking for future multi-tenant uploads
  pgm.addColumn('wallpapers', {
    author_id: {
      type: 'uuid',
      references: 'admins',
      onDelete: 'SET NULL',
    },
  });

  // Drop the old flat category string (migrated to category_id)
  pgm.dropColumn('wallpapers', 'category');

  // Indexes for the hot query paths
  pgm.createIndex('wallpapers', 'content_type');
  pgm.createIndex('wallpapers', 'visible_date');
  pgm.createIndex('wallpapers', 'category_id');
  pgm.createIndex('wallpapers', 'is_sponsor');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.addColumn('wallpapers', {
    category: { type: 'varchar(100)', notNull: true, default: "'general'" },
  });
  pgm.dropColumn('wallpapers', 'title');
  pgm.dropColumn('wallpapers', 'content_type');
  pgm.dropColumn('wallpapers', 'category_id');
  pgm.dropColumn('wallpapers', 'visible_date');
  pgm.dropColumn('wallpapers', 'expires_on');
  pgm.dropColumn('wallpapers', 'is_sponsor');
  pgm.dropColumn('wallpapers', 'author_id');
};
