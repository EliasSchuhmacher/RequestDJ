import pkg from 'pg';

const { Pool } = pkg;

const clientId = process.env.SPOTIFY_CLIENT_ID;
console.log(clientId)
// Get connection information from .env file
const { PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD } = process.env;

console.log({ PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD })
const db = new Pool ({
    host: PG_HOST,
    port: PG_PORT,
    database: PG_DATABASE,
    user: PG_USER,
    password: PG_PASSWORD
})

export default db;