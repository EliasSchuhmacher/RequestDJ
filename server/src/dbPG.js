import pkg from 'pg';

const { Pool } = pkg;

// Get connection information from .env file
const { PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD } = process.env;

// Configure pool options
const poolConfig = {
  host: PG_HOST,
  port: PG_PORT,
  database: PG_DATABASE,
  user: PG_USER,
  password: PG_PASSWORD,
};

// Enable SSL in production environment
if (PG_HOST !== 'localhost') {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

// Create a new connection pool
const db = new Pool(poolConfig);

export default db;