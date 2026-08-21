/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Books are the Library story content: a book is an ordered set of pages,
 * each page being an image with a title (and optional text).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.createTable('books', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    title: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    // Cloudinary asset for the cover (optional — pages carry the real content)
    cover_public_id: {
      type: 'varchar(255)',
    },
    cover_url: {
      type: 'text',
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

  pgm.createIndex('books', 'is_active');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.dropTable('books');
};
