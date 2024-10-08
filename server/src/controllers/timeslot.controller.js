/* eslint-disable camelcase */
import { Router } from "express";
import Model from "../model.js";
import db from "../dbPG.js";

const router = Router();

/**
 * API (see the route handlers below) should combine uniquely identifiable resources (paths)
 * with the appropriate HTTP request methods (GET, POST, PUT, DELETE and more) to manipulate them.
 *
 * GET     /timeslots                       =>  Get all timeslots
 * POST    /timeslots                       =>  Book the timeslot with supplied timeslotID and record bookers name
 * POST    /reserve                         =>  Reserve the timeslot with supplied timeslotID
 * etc.
 */

const getSpotifyAccessToken = async () => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    
    const data = await response.json();
    // console.log('Spotify Access Token obtained successfully.', data);
    // Update token and expiry time
    //tokenExpiresAt = Date.now() + response.data.expires_in * 1000; // Set expiration time (in milliseconds)
    return data.access_token;
  } catch (error) {
    console.error('Failed to get Spotify Access Token:', error);
    throw new Error('Unable to fetch Spotify Access Token');
  }
};

const validateBookersName = (name) => {
  if (/[0-9]/.test(name) || name.length < 3) {
    return false;
  }
  return true;
};

router.get("/timeslots", async (req, res) => {
  const timeslots = await db.all("SELECT * FROM timeslots;");

  // Choose the appropriate HTTP response status code and send an HTTP response, if any, back to the client
  res.status(200).json({ timeslots });
});

router.get("/spotify/token", async (req, res) => {
  //console.log("we are in the spotify/token function")
  try {
    // Fetch a new token
    const spotifyAccessToken = await getSpotifyAccessToken();
    //console.log(spotifyAccessToken)
    //console.log("hej")
    // Return the token to the client
    res.status(200).json({ accessToken: spotifyAccessToken });
  } catch (error) {
    res.status(500).send('Spotify Access Token is not available.');
  }
});

router.post("/check_dj_exist", async (req, res) => {
  const DJ_name = req.body.djName.trim();
  
  
  const result = await db.query(
    "SELECT name FROM users WHERE name = $1",
    [DJ_name]
  );
  const existingUser = result.rows[0];
  
  console.log(existingUser)
  console.log("vi är i check_dj_exist, efter existingUser")
  //const allDJs = await db.all("SELECT name FROM assistants");  
  // Log all DJs to the console for debugging
  
  if (existingUser) {
    // User already exist
    res.status(200).send();
  } else {
    res.status(404).json({ message: "Dj not found" });
  }
});


// Add a song request for a specific user:
router.post("/songs", async (req, res) => {
  const { DJ_name, song_title, song_artist } = req.body;

  // Make sure DJ_name, song_name or artist are supplied in request
  if (!DJ_name || (!song_title && !song_artist)) {
    // Invalid request, send response code 400;
    res.status(400).send();
    return;
  }

  const DJresult = await db.query("SELECT * FROM users WHERE name = $1;", [DJ_name]);
  if (DJresult.rowCount === 0) {
    // DJ does not exist, send response code 404;
    res.status(404).json({ message: "Invalid DJ name in URL" });
    return;
  }

  // Get the session id of the requester, and store it with the song request
  const requester_session_id = req.sessionID;

  // Insert song request into database
  const insertResult = await db.query(
    "INSERT INTO songrequests (DJ_username, song_title, song_artist, requester_session_id) VALUES ($1, $2, $3, $4) RETURNING id;",
    [DJ_name, song_title, song_artist, requester_session_id]
  );

  // Choose the appropriate HTTP response status code and send an HTTP response, if any, back to the client
  res.status(200).end();

  const newId = insertResult.rows[0].id;
  // console.log("New ID: ", newId);

  // Do not send requester_session_id to client! (Do not use Select * FROM...)
  const result = await db.query(
    "SELECT id, song_title, song_artist, request_date, status, dj_username FROM songrequests WHERE id = $1;",
    [newId]
  );
  const songRequest = result.rows[0];
  console.log("Song Title: ", songRequest.song_title);

  // TODO: Send websocket message only to correct DJ instead of broadcasting
  Model.broadcastNewSongRequest(songRequest);

});



export default { router };
