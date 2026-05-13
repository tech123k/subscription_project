require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function run() {
  const sqlPath = path.join(__dirname, '../../database/migrations/006_convert_enums_to_varchar.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 006 applied: enum columns converted to VARCHAR');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 006 failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
