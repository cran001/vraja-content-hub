/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.createTable('categories', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    slug: {
      type: 'varchar(255)',
      notNull: true,
    },
    // Self-referencing FK for infinite nesting. NULL = root category.
    parent_id: {
      type: 'uuid',
      references: 'categories',
      onDelete: 'CASCADE',
    },
    // 0 = root, 1 = sub, 2 = sub-sub, etc.
    level: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Faster lookups when building child lists
  pgm.createIndex('categories', 'parent_id');
  // Unique slug per parent (root slugs must be globally unique)
  pgm.createIndex('categories', ['parent_id', 'slug'], { unique: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.dropTable('categories');
};
