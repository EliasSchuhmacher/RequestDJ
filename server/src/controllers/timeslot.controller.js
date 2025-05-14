/* eslint-disable camelcase */
import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import Model from "../model.js";
import db from "../dbPG.js";
import sessionStore from '../sessionStore.js'; // Import the session store

const ai = new GoogleGenAI({ apiKey: process.env.AI_API_KEY });

const router = Router();

// Cache Spotify access token (app token) in memory
let cachedSpotifyToken = null;
let tokenExpiresAt = 0;

/**
 * Retrieves a Spotify app access token using client credentials flow.
 * Caches the token until it expires.
 * @param {boolean} forceRefresh - If true, force fetch a new token even if the current one is still valid.
 * @returns {Promise<string>} - Spotify access token
 */
const getSpotifyAccessToken = async (forceRefresh = false) => {
  const currentTime = Date.now();

  if (!forceRefresh && cachedSpotifyToken && currentTime < tokenExpiresAt) {
    return cachedSpotifyToken;
  }

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

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to fetch token: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    cachedSpotifyToken = data.access_token;
    tokenExpiresAt = currentTime + data.expires_in * 1000 - 60 * 1000; // Refresh 1 min before actual expiry

    return cachedSpotifyToken;
  } catch (error) {
    console.error('Failed to get Spotify Access Token:', error);
    throw new Error('Unable to fetch Spotify Access Token');
  }
};

// Function to refresh a personal Spotify access token (auth code flow), throws an error if it fails so call needs to be inside try/catch
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

// Function to fetch metadata for a song given its Spotify ID
const fetchSpotifySongMetadata = async (spotifyId) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const accessToken = await getSpotifyAccessToken();
  try {
    const response = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Error fetching song metadata: ${response.statusText}`);
    }
    const data = await response.json();
    return {
      title: data.name,
      artist: data.artists[0].name,
      album: data.album.name,
      imageUrl: data.album.images[0]?.url,
      popularity: data.popularity,
      duration: data.duration_ms / 1000, // Convert milliseconds to seconds
      explicit: data.explicit,
    };
  } catch (error) {
    console.error('Failed to fetch Spotify song metadata:', error);
    throw new Error(`Failed to fetch Spotify song metadata: ${error.message}`);
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

// Check if the DJ exists and is currently accepting requests
router.post("/check_dj_status", async (req, res) => {
  const DJ_name = req.body.DJ_name.trim();

  console.log("Checking DJ status for DJ_name: ", DJ_name);

  if (!DJ_name) {
    // Invalid request, send response code 400;
    res.status(404).json({ message: "Invalid request: DJ name is required" });
    return;
  }

  // Step 2: If no session exists, check if the DJ exists in the database
  const result = await db.query(
    "SELECT name, currently_accepting FROM users WHERE name = $1",
    [DJ_name]
  );
  const existingUser = result.rows[0];

  if (!existingUser) {
    // DJ does not exist
    res.status(404).json({ message: "DJ not found" });
    return;
  }

  // Response based on whether the DJ is accepting requests
  if (existingUser.currently_accepting) {
    // DJ is accepting requests
    res.status(200).json({ message: "DJ is accepting requests" });
  } else {
    // DJ is not accepting requests
    res.status(403).json({ message: "DJ is not accepting requests" });
  }

});

// Check if a DJ is logged in and exists based on logged in sessions. (UNUSED)
// router.post("/check_dj_status", async (req, res) => {
//   const DJ_name = req.body.DJ_name.trim();

//   console.log("Checking DJ status for DJ_name: ", DJ_name);

//   if (!DJ_name) {
//     // Invalid request, send response code 400;
//     res.status(404).json({ message: "Invalid request: DJ name is required" });
//     return;
//   }

//   // Step 1: Check if the DJ has a valid session
//   const session = await getSessionForUser(DJ_name);
//   if (session) {
//     // Make sure the session has not expired
//     const currentTime = Date.now();
//     const sessionExpirationTime = new Date(session.expires).getTime(); // Convert ISO string to timestamp
//     if (currentTime > sessionExpirationTime) {
//       res.status(401).json({ message: "Unauthorized: Session has expired" });
//       return;
//     }

//     // DJ is logged in and session is valid
//     res.status(200).send();
//     return;
//   }

//   // Step 2: If no session exists, check if the DJ exists in the database
//   const result = await db.query(
//     "SELECT name FROM users WHERE name = $1",
//     [DJ_name]
//   );
//   const existingUser = result.rows[0];

//   if (!existingUser) {
//     // DJ does not exist
//     res.status(404).json({ message: "DJ not found" });
//     return;
//   }

//   // DJ exists but is not logged in
//   res.status(401).json({ message: "Unauthorized: DJ is not logged in" });
// });

// Add a song request for a specific user:
router.post("/songs", async (req, res) => {
  console.log("✅ Received POST /api/songs");

  // song genre and requester_name defaults to empty string, if not provided
  const { DJ_name, song_title, song_artist, song_spotify_id, song_genre = '', requester_name = '', song_image_url = '', song_popularity_score = '', song_duration = '', song_explicit = false } = req.body;

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

  // Check if the DJ is currently accepting requests
  const DJ = DJresult.rows[0];
  if (!DJ.currently_accepting) {
    // DJ is not accepting requests, send response code 403;
    res.status(403).json({ message: "DJ is not accepting requests" });
    return;
  }

  // Get the session id of the requester, and store it with the song request
  const requester_session_id = req.sessionID;

  // Use AI to determine whether the song is acceptable or not
  const songString = `
    Title & Artist: ${song_title}
    Genre: ${song_genre || "N/A"}
    Duration: ${song_duration || "N/A"} seconds
    Popularity: ${song_popularity_score || "N/A"} (0-100)
    Explicit: ${song_explicit ? "True" : "False"}
    `;

  console.log("Song String: ", songString);

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: songString,
    config: {
      systemInstruction: process.env.AI_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object", // Define the schema as a plain string
        properties: {
          chainOfThought: {
            type: "string",
          },
          accepted: {
            type: "boolean", // Use plain strings for types
          },
          reason: {
            type: "string",
          },
        },
        required: ["chainOfThought", "accepted", "reason"], // Ensure all fields are required
      },
    },
  });

  console.log("AI response: ", response.text);
  // Parse the AI response as JSON
  let ai_response;
  let ai_accepted;
  let ai_reason;
  try {
    ai_response = JSON.parse(response.text);
    ai_accepted = ai_response?.accepted;
    ai_reason = ai_response?.reason;
    console.log("AI Accepted: ", ai_accepted);
    console.log("AI Reason: ", ai_reason);
  } catch (error) {
    console.error("Failed to parse AI response as JSON:", error);
  }


  // Insert song request into database
  const insertResult = await db.query(
    "INSERT INTO songrequests (DJ_username, song_title, song_artist, requester_session_id, requester_name, song_genre, song_spotify_id, song_image_url, song_popularity_score, ai_accepted, ai_reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *;",
    [DJ_name, song_title, song_artist, requester_session_id, requester_name, song_genre, song_spotify_id, song_image_url, song_popularity_score, ai_accepted, ai_reason]
  );

  const newId = insertResult.rows[0].id;
  // console.log("New ID: ", newId);
  
  // Choose the appropriate HTTP response status code and send an HTTP response back to the client
  // Return the new song request json object to the client so that it has the id
  res.status(201).json(insertResult.rows[0]);

  // Do not send requester_session_id to client! (Do not use Select * FROM...)
  const result = await db.query(
    "SELECT id, song_title, song_artist, request_date, status, dj_username, requester_name, song_genre, song_spotify_id, song_image_url, song_popularity_score, ai_accepted, ai_reason FROM songrequests WHERE id = $1;",
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
