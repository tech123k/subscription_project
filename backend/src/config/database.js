// const { Pool } = require('pg');
// const logger = require('../utils/logger');

// const pool = new Pool({
//   host: process.env.DB_HOST || 'localhost',
//   port: parseInt(process.env.DB_PORT) || 5432,
//   user: process.env.DB_USER || 'erpadmin',
//   password: process.env.DB_PASSWORD || 'erppassword',
//   database: process.env.DB_NAME || 'erp_system',
//   max: 20,
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 5000,
//   ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
// });

// pool.on('connect', () => {
//   logger.info('New database connection established');
// });

// pool.on('error', (err) => {
//   logger.error('Unexpected database error:', err);
// });

// const query = async (text, params) => {
//   const start = Date.now();
//   try {
//     const res = await pool.query(text, params);
//     const duration = Date.now() - start;
//     if (duration > 1000) {
//       logger.warn('Slow query detected', { text, duration, rows: res.rowCount });
//     }
//     return res;
//   } catch (error) {
//     logger.error('Database query error', { text, error: error.message });
//     throw error;
//   }
// };

// const getClient = () => pool.connect();

// const transaction = async (callback) => {
//   const client = await pool.connect();
//   try {
//     await client.query('BEGIN');
//     const result = await callback(client);
//     await client.query('COMMIT');
//     return result;
//   } catch (error) {
//     await client.query('ROLLBACK');
//     throw error;
//   } finally {
//     client.release();
//   }
// };

// const testConnection = async () => {
//   try {
//     const res = await pool.query('SELECT NOW()');
//     logger.info(`Database connected at ${res.rows[0].now}`);
//     return true;
//   } catch (error) {
//     logger.error('Database connection failed:', error.message);
//     throw error;
//   }
// };

// module.exports = { query, getClient, transaction, testConnection, pool };
const { Pool } = require('pg');
const logger = require('../utils/logger');

const isProduction = process.env.NODE_ENV === 'production';

// const pool = new Pool({
//   host: process.env.DB_HOST,
//   port: parseInt(process.env.DB_PORT, 10) || 5432,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,

//   // Pool settings — keep small for Supabase free tier (max 20 direct connections)
//   max: 5,
//   min: 1,                        // always keep 1 warm connection to avoid cold SSL overhead
//   idleTimeoutMillis: 60000,      // 60s before idle connections are released (> Supabase idle cut)
//   connectionTimeoutMillis: 15000,

//   // Keep TCP connections alive so Supabase doesn't terminate idle sockets
//   keepAlive: true,
//   keepAliveInitialDelayMillis: 10000,

//   // SSL for Supabase / Render production
//   ssl:
//     process.env.DB_SSL === 'true'
//       ? { rejectUnauthorized: false }
//       : false,
// });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Pool settings
  max: 5,
  min: 1,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 15000,

  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,

  ssl: false,
});
// Unexpected errors on idle clients — log and let the pool replace them
pool.on('error', (err, client) => {
  logger.error('Idle client error (connection will be replaced):', err.message);
});

const RETRYABLE = ['Connection terminated', 'Connection terminated due to connection timeout', 'write ECONNRESET', 'read ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'];

const isRetryable = (err) => RETRYABLE.some((msg) => err.message?.includes(msg));

// Query helper — retries once on transient connection errors
const query = async (text, params, attempt = 1) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('Slow query detected', { query: text, duration: `${duration}ms`, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    if (attempt === 1 && isRetryable(error)) {
      logger.warn('Retrying query after connection error:', error.message);
      await new Promise((r) => setTimeout(r, 200));
      return query(text, params, 2);
    }
    logger.error('Database query error', { query: text, message: error.message });
    throw error;
  }
};

// Get raw client
const getClient = async () => {
  return await pool.connect();
};

// Transaction helper
const transaction = async (callback) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');

    logger.error('Transaction failed:', error.message);

    throw error;
  } finally {
    client.release();
  }
};

// Test DB connection
const testConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW()');

    logger.info(`Database connected successfully at ${res.rows[0].now}`);

    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);

    throw error;
  }
};

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  testConnection,
};