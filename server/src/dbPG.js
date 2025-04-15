import pkg from 'pg';

const { Pool } = pkg;

// Get connection information from .env file
const { PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD } = process.env;


// Create a new connection pool
const db = new Pool ({
    host: PG_HOST,
    port: PG_PORT,
    database: PG_DATABASE,
    user: PG_USER,
    password: PG_PASSWORD,
    ssl: {
       rejectUnauthorized: false
    }
})

export default db;