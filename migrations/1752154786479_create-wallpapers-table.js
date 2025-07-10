/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.createTable('wallpapers', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    category: {
      type: 'varchar(100)',
      notNull: true,
    },
    // The unique ID from Cloudinary for managing the asset
    public_id: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    // The full URL for the high-resolution, original image
    original_url: {
      type: 'text',
      notNull: true,
    },
    // The URL for the small, optimized thumbnail
    thumbnail_url: {
      type: 'text',
      notNull: true,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
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

  // Add an index on the category for faster filtering
  pgm.createIndex('wallpapers', 'category');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.dropTable('wallpapers');
};