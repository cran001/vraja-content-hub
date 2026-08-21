/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Ordered pages inside a book. Deleting a book removes its pages (CASCADE).
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.createTable('book_pages', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    book_id: {
      type: 'uuid',
      notNull: true,
      references: 'books',
      onDelete: 'CASCADE',
    },
    // 1-based reading order within the book
    page_number: {
      type: 'integer',
      notNull: true,
    },
    title: {
      type: 'varchar(255)',
      notNull: true,
    },
    // Optional caption / story text shown alongside the image
    body_text: {
      type: 'text',
    },
    public_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    image_url: {
      type: 'text',
      notNull: true,
    },
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

  pgm.createIndex('book_pages', 'book_id');
  // One page per position within a book
  pgm.createIndex('book_pages', ['book_id', 'page_number'], { unique: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.dropTable('book_pages');
};
