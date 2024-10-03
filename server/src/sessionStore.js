import session from 'express-session';
import connectSqlite3 from 'connect-sqlite3';

const SQLiteStore = connectSqlite3(session);

const sessionStore = new SQLiteStore({
    db: 'sessions.sqlite', // Name of the SQLite database file
    table: 'sessions', // Name of the table to store sessions
  });

export default sessionStore;