-- schema.sql
--DROP TABLE IF EXISTS songrequests;
--DROP TABLE IF EXISTS users;
-- USERS
CREATE TABLE IF NOT EXISTS users (
  name TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  spotify_access_token TEXT,
  spotify_refresh_token TEXT    -- ✅ And this
);

-- SONG REQUESTS table (name: songrequests to match query)
CREATE TABLE IF NOT EXISTS songrequests (
  id SERIAL PRIMARY KEY,
  song_title TEXT NOT NULL,
  song_artist TEXT,
  song_spotify_id TEXT,
  song_genre TEXT,
  requester_name TEXT,
  requester_session_id TEXT, -- ✅ added this line
  dj_username TEXT REFERENCES users(name),
  request_date TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'pending'
);

