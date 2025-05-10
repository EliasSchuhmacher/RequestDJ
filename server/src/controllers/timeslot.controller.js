/* eslint-disable camelcase */
import { Router } from "express";
import Model from "../model.js";
import db from "../dbPG.js";
import sessionStore from '../sessionStore.js'; // Import the session store


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

// Function to refresh the Spotify access token, throws an error if it fails so call needs to be inside try/catch
const refreshSpotifyAccessToken = async (username) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  // Get the refresh token from the database
  const result = await db.query(
    "SELECT spotify_refresh_token FROM users WHERE name = $1",
    [username]
  );
  const refresh_token = result.rows[0]?.spotify_refresh_token;

  if (!refresh_token) {
    throw new Error(`No refresh token found for user: ${username}`);
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error refreshing Spotify token: ${response.statusText}`);
    }

    const data = await response.json();

    // Update the access token in the database
    await db.query(
      "UPDATE users SET spotify_access_token = $1 WHERE name = $2",
      [data.access_token, username]
    );
    // if there is a new refresh token, update it in the database
    if (data.refresh_token) {
      await db.query(
        "UPDATE users SET spotify_refresh_token = $1 WHERE name = $2",
        [data.refresh_token, username]
      );
    }

    return data.access_token; // Return the new access token
  }
  catch (error) { 
    console.error('Failed to refresh Spotify Access Token:', error);
    throw new Error(`Failed to refresh Spotify Access Token for user: ${username}. ${error.message}`);
  }
  
};

// Helper function to get the session for a user
async function getSessionForUser(username) {
  return new Promise((resolve, reject) => {
    sessionStore.db.all('SELECT * FROM sessions', (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      const userSession = rows.find(row => {
        const sessionData = JSON.parse(row.sess);
        return sessionData.user === username;
      });
      resolve(userSession);
    });
  });
}

router.get("/spotify/token", async (req, res) => {
  // console.log("we are in the spotify/token function")
  try {
    // Fetch a new token
    const spotifyAccessToken = await getSpotifyAccessToken();
    // console.log(spotifyAccessToken)
    // console.log("hej")
    // Return the token to the client
    res.status(200).json({ accessToken: spotifyAccessToken });
  } catch (error) {
    res.status(500).send('Spotify Access Token is not available.');
  }
});

// Check if a DJ is logged in and exists
router.post("/check_dj_status", async (req, res) => {
  const DJ_name = req.body.DJ_name.trim();

  console.log("Checking DJ status for DJ_name: ", DJ_name);

  if (!DJ_name) {
    // Invalid request, send response code 400;
    res.status(404).json({ message: "Invalid request: DJ name is required" });
    return;
  }

  // Step 1: Check if the DJ has a valid session
  const session = await getSessionForUser(DJ_name);
  if (session) {
    // Make sure the session has not expired
    const currentTime = Date.now();
    const sessionExpirationTime = new Date(session.expires).getTime(); // Convert ISO string to timestamp
    if (currentTime > sessionExpirationTime) {
      res.status(401).json({ message: "Unauthorized: Session has expired" });
      return;
    }

    // DJ is logged in and session is valid
    res.status(200).send();
    return;
  }

  // Step 2: If no session exists, check if the DJ exists in the database
  const result = await db.query(
    "SELECT name FROM users WHERE name = $1",
    [DJ_name]
  );
  const existingUser = result.rows[0];

  if (!existingUser) {
    // DJ does not exist
    res.status(404).json({ message: "DJ not found" });
    return;
  }

  // DJ exists but is not logged in
  res.status(401).json({ message: "Unauthorized: DJ is not logged in" });
});

// Add a song request for a specific user:
router.post("/songs", async (req, res) => {
  console.log("✅ Received POST /api/songs");

  // song genre and requester_name defaults to empty string, if not provided
  const { DJ_name, song_title, song_artist, song_spotify_id, song_genre = '', requester_name = '', song_image_url = '', song_popularity_score = '' } = req.body; 

  // Make sure DJ_name, song_name or artist are supplied in request
  if (!DJ_name || (!song_title && !song_artist)) {
    // Invalid request, send response code 400;
    res.status(400).send();
    return;
  }

  // Check if DJ exists
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
    "INSERT INTO songrequests (DJ_username, song_title, song_artist, requester_session_id, requester_name, song_genre, song_spotify_id, song_image_url, song_popularity_score) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;",
    [DJ_name, song_title, song_artist, requester_session_id, requester_name, song_genre, song_spotify_id, song_image_url, song_popularity_score]
  );

  const newId = insertResult.rows[0].id;
  // console.log("New ID: ", newId);
  
  // Choose the appropriate HTTP response status code and send an HTTP response back to the client
  // Return the new song request json object to the client so that it has the id
  res.status(201).json(insertResult.rows[0]);

  // Do not send requester_session_id to client! (Do not use Select * FROM...)
  const result = await db.query(
    "SELECT id, song_title, song_artist, request_date, status, dj_username, requester_name, song_genre, song_spotify_id, song_image_url, song_popularity_score FROM songrequests WHERE id = $1;",
    [newId]
  );
  const songRequest = result.rows[0];
  console.log("Song Title: ", songRequest.song_title);

  // TODO: Send websocket message only to correct DJ instead of broadcasting
  Model.broadcastNewSongRequest(songRequest);

});

// Create an endpoint for retrieving a users spotify queue
router.get("/spotifyqueue/:username", async (req, res) => {
  const { username } = req.params;

  if (!username) {
    // Request missing properties, don't let it crash the server
    res.send(400).send();
    return;
  }

  // if (username !== req.session.user) {
  //   // Trying to access another users spotify queue, security issue?
  //   res.status(401).send();
  //   return;
  // }
  
   // Check if the target user is logged in
  const session = await getSessionForUser(username);
  if (!session) {
    res.status(401).json({ message: "Unauthorized: Target user is not logged in", redirect: "login" });
    return;
  }

  // Retrieve the users spotify access token
  const result = await db.query(
    "SELECT spotify_access_token FROM users WHERE name=$1",
    [username]
  );
  let spotifyAccessToken = result.rows[0]?.spotify_access_token;

  if (!spotifyAccessToken) {
    // User has not connected to spotify
    res.status(401).send();
    return;
  }

  // Retrieve the users spotify queue from /me/player/queue
  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${spotifyAccessToken}`
      }
    });

    if (!response.ok) {
      const errorBody = await response.json(); // Read the response body for additional error details
      const errorMessage = errorBody?.error?.message || JSON.stringify(errorBody);
      // if the response is 401, try to refresh the token
      if (response.status === 401) {
        console.log("Spotify token expired, refreshing...");
        spotifyAccessToken = await refreshSpotifyAccessToken(username); // Get a new access token
        // Retry the request with the new token
        const newResponse = await fetch('https://api.spotify.com/v1/me/player/queue', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${spotifyAccessToken}`
          }
        });
        if (!newResponse.ok) {
          const newErrorBody = await newResponse.json();
          const newErrorMessage = newErrorBody?.error?.message || JSON.stringify(newErrorBody);
          throw new Error(`HTTP error! status: ${newResponse.status}, message: ${newErrorMessage}`);
        }
        const spotifyQueue = await newResponse.json();
        res.status(200).json({ spotifyQueue });
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
    }

    const spotifyQueue = await response.json();
    res.status(200).json({ spotifyQueue });
  } catch (error) {
    console.error('Failed to retrieve Spotify queue:', {
      message: error.message,
    });
  
    res.status(500).json({
      error: `An error occurred while retrieving the Spotify queue: ${error.message}`,
    }); 
  }
});

// Create an endpoint that retreives the status of a song request
router.get("/songrequests/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    // Request missing properties, don't let it crash the server
    res.send(400).send();
    return;
  }

  // Get the song request from the database
  const result = await db.query(
    "SELECT id, song_title, song_artist, request_date, status, dj_username, requester_name, song_genre FROM songrequests WHERE id = $1;",
    [id]
  );
  const songRequest = result.rows[0];

  if (!songRequest) {
    // Song request not found
    res.status(404).send();
    return;
  }

  // Send the song request back to the client
  res.status(200).json(songRequest);
});


export { router, refreshSpotifyAccessToken };
