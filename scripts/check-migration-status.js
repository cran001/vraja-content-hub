const { Client } = require('pg');

async function checkMigrationStatus() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Check if pgmigrations table exists
    const migrationTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'pgmigrations'
      );
    `);

    if (!migrationTableCheck.rows[0].exists) {
      console.log('❌ pgmigrations table does not exist');
      console.log('   This is a fresh database - all migrations need to run\n');
      return;
    }

    // Get applied migrations
    const applied = await client.query(`
      SELECT name, run_on
      FROM pgmigrations
      ORDER BY run_on
    `);

    console.log('Applied migrations:');
    if (applied.rows.length === 0) {
      console.log('  (none)\n');
    } else {
      applied.rows.forEach(row => {
        console.log(`  ✓ ${row.name} (${row.run_on.toISOString().split('T')[0]})`);
      });
      console.log();
    }

    // Check which tables exist
    const tables = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log('Existing tables:');
    tables.rows.forEach(row => {
      console.log(`  • ${row.tablename}`);
    });
    console.log();

    // Check for the specific error - does description_hi exist?
    const descHiCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'dated_events' AND column_name = 'description_hi'
      );
    `);

    if (descHiCheck.rows[0].exists) {
      console.log('⚠️  Column dated_events.description_hi already exists');
      console.log('   This suggests migrations were partially applied outside node-pg-migrate\n');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkMigrationStatus();
