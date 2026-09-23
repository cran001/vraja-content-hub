const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Explicit account provisioning only. Never resets or overwrites an existing account.
async function createAdmin() {
  const { DATABASE_URL, HUB_ADMIN_EMAIL, HUB_ADMIN_PASSWORD, HUB_ADMIN_ROLE, HUB_CONFIRM_ACCOUNT_CREATE } = process.env;
  if (!DATABASE_URL || !HUB_ADMIN_EMAIL || !HUB_ADMIN_PASSWORD || HUB_ADMIN_PASSWORD.length < 16
      || !['super_admin','community_admin'].includes(HUB_ADMIN_ROLE) || HUB_CONFIRM_ACCOUNT_CREATE !== 'yes') {
    throw new Error('Explicit database, email, password (16+ characters), role and account-creation confirmation are required.');
  }
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const hash = await bcrypt.hash(HUB_ADMIN_PASSWORD,12);
    const result = await pool.query('INSERT INTO admins(email,password_hash,role) VALUES ($1,$2,$3) ON CONFLICT(email) DO NOTHING',[HUB_ADMIN_EMAIL,hash,HUB_ADMIN_ROLE]);
    console.log(result.rowCount ? 'Account created.' : 'Account already exists; unchanged.');
  } finally { await pool.end(); }
}
createAdmin().catch(() => { console.error('Account provisioning failed. Check required settings without logging credentials.'); process.exitCode=1; });
