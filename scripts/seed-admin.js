const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// --- Configuration ---
// Change these values to your desired admin credentials
const adminEmail = 'admin@vraja.com';
const adminPassword = 'password123';
// ---------------------

async function seedAdmin() {
  console.log('Starting admin user seeding...');

  // 1. Get the database connection string from the .env file
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set!');
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    // 2. Hash the password
    console.log(`Hashing password for user: ${adminEmail}`);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);
    console.log('Password hashed successfully.');

    // 3. Insert the new admin user into the database
    const queryText = `
      INSERT INTO admins (email, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (email) DO NOTHING; 
    `;
    // 'ON CONFLICT DO NOTHING' prevents errors if you run the script more than once.
    
    const res = await client.query(queryText, [adminEmail, passwordHash]);
    
    if (res.rowCount > 0) {
      console.log('✅ Admin user created successfully!');
    } else {
      console.log('ℹ️ Admin user with this email already exists.');
    }

  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
  } finally {
    // 4. Release the database connection
    await client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

seedAdmin();