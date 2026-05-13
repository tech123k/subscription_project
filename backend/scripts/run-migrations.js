/**
 * Run all pending database migrations in order.
 * Usage: node backend/scripts/run-migrations.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../../database/migrations');

const ORDERED_MIGRATIONS = [
  'add_warehouse_contact_person.sql',
  'add_performance_indexes.sql',
  'add_production_stage_reverts.sql',
  'add_purchase_orders.sql',
  '004_product_bom.sql',
  '005_production_tracking.sql',
  '006_convert_enums_to_varchar.sql',
  '007_product_stock_columns.sql',
  '008_dispatch_items_product_id.sql',
  '009_production_orders_product_id.sql',
  '010_phase1_features.sql',
  '011_phase1_complete.sql',   // idempotent fix — safe even if 010 already applied
];

// Supabase requires SSL; local dev typically does not.
const sslConfig = process.env.DATABASE_URL?.includes('supabase')
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig });

async function run() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table if needed
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const appliedRes = await client.query('SELECT name FROM _migrations');
    const applied = new Set(appliedRes.rows.map((r) => r.name));

    for (const file of ORDERED_MIGRATIONS) {
      if (applied.has(file)) {
        console.log(`⏭  ${file} — already applied`);
        continue;
      }

      const sqlPath = path.join(MIGRATIONS_DIR, file);
      if (!fs.existsSync(sqlPath)) {
        console.warn(`⚠️  ${file} — file not found, skipping`);
        continue;
      }

      const sql = fs.readFileSync(sqlPath, 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ ${file} — applied`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ ${file} — FAILED: ${err.message}`);
        process.exit(1);
      }
    }

    console.log('\nAll migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Migration runner error:', err.message);
  process.exit(1);
});
