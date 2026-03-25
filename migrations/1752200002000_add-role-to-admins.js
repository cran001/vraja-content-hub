/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  // Role: super_admin can manage everything; community_admin is scoped to their community
  pgm.addColumn('admins', {
    role: {
      type: 'varchar(50)',
      notNull: true,
      default: "'super_admin'",
    },
  });

  // Future: individual temples / communities get their own admin accounts
  pgm.addColumn('admins', {
    community_name: { type: 'varchar(255)' },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.dropColumn('admins', 'role');
  pgm.dropColumn('admins', 'community_name');
};
