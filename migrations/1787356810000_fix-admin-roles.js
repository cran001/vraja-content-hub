exports.up = async (pgm) => {
  // Fix incorrectly quoted role values
  pgm.sql(`
    UPDATE admins
    SET role = 'super_admin'
    WHERE role = '''super_admin'''
  `);

  pgm.sql(`
    UPDATE admins
    SET role = 'community_admin'
    WHERE role = '''community_admin'''
  `);
};

exports.down = async (pgm) => {
  // No rollback - this is a data correction
};
