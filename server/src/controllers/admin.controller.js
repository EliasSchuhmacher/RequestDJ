import e, { json, Router } from "express";
import Model from "../model.js";
import db from "../dbPG.js";
import sessionStore from '../sessionStore.js'; // Import the session store
import { refreshSpotifyAccessToken } from './timeslot.controller.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * API (see the route handlers below) should combine uniquely identifiable resources (paths)
 * with the appropriate HTTP request methods (GET, POST, PUT, DELETE and more) to manipulate them.
 *
 * Admin endpoints only to be accessed when user is authenticated:
 * POST    /logout                       =>  Try to logout with details supplied in request body
 * POST    /newtime                      =>  Try to login with details supplied in request body
 * POST    /removetime                   =>  Try to login with details supplied in request body
 * etc.
 */




router.post("/logout", async (req, res) => {
  console.log("Logout called on serverside");
  res.clearCookie("dj_logged_in");
  //should we clear this? res.clearCookie("connect.sid");

  req.session.authenticated = false;
  req.session.user = "";
  res.status(200).send();
});

// Create an endpoint that checks if the user has connected to spotify
router.get("/checkspotifyconnected", async (req, res) => {
  const username = req.session.user;

  const result = await db.query(
    "SELECT spotify_access_token FROM users WHERE name=$1",
    [username]
  );
  const spotifyAccessToken = result.rows[0]?.spotify_access_token;

  if (spotifyAccessToken) {
    // User has connected to spotify
    console.log("connected to spotify")
    res.status(200).json({ connected: true });
  } else {
    // User has not connected to spotify
    console.log("not connected to spotify")
    res.status(200).json({ connected: false });
  }
});

// Create an endpoint for retrieving song requests for a specific user
router.get("/songs/:username", async (req, res) => {
  const { username } = req.params;

  if (!username) {
    // Request missing properties, don't let it crash the server
    res.send(400).send();
    return;
  }

  if (username !== req.session.user) {
    // Trying to access another users song requests
    res.status(401).send();
    return;
  }

  // Do not send requester_session_id to client! (Do not use Select * FROM...)
  const result = await db.query(
    'SELECT id, song_title, song_artist, request_date, status, dj_username, requester_name, song_genre, song_spotify_id, song_image_url FROM songrequests WHERE dj_username = $1;',
    [username]
  );
  const songRequests = result.rows;

  res.status(200).json({ songRequests });
});

// Connect to spotify:
router.get("/spotifylogin", async (req, res) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  const state = uuidv4();
  const scope = 'user-read-private user-read-email user-read-currently-playing user-read-playback-state user-modify-playback-state';

  // Save the state in the session
  req.session.spotifyState = state;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    state
  });

  console.log("Spotify login called, redirecting to Spotify with params:", params.toString());
  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// Disconnect from spotify:
router.post("/spotifydisconnect", async (req, res) => {
  const username = req.session.user;

  // Check that the user is logged in
  if (!username) {
    // User is not logged in, send response code 401;
    res.send(400).send();
    return;
  }

  console.log("Spotify disconnect called for user:", username);
  // Remove the access token from the database
  await db.query(
    "UPDATE users SET spotify_access_token = NULL, spotify_refresh_token = NULL WHERE name = $1",
    [username]
  );
  console.log("Spotify access token removed from database for user:", username);

  // Respond with success
  res.status(200).send();
});

// Callback from spotify:
router.get("/spotifycallback", async (req, res) => {

  const { code, state, error } = req.query;
  console.log("Spotify callback called with code:", code, "and state:", state);
  if (error) {
    // Spotify returned an error, send response code 400;
    console.log("Spotify returned an error:", error);
    res.redirect('/admin?error=spotifyautherror');
    return;
  }

  if (!code || !state) {
    // Invalid request, send response code 400;
    console.log("Invalid callback request, missing code or state");
    res.redirect('/admin?error=spotifyautherror');
    return;
  }

  // Check that the state matches the one sent in the initial request
  if (state !== req.session.spotifyState) {
    // Invalid state, send response code 401;
    console.log("Invalid state in callback request");
    res.redirect('/admin?error=spotifyautherror');
    return;
  }

  // Request an access token from Spotify
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    },
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    },
    json: true
  };

  try {
    const response = await fetch(authOptions.url, {
      method: 'POST',
      headers: authOptions.headers,
      body: new URLSearchParams(authOptions.form)
    });

    const data = await response.json();
    console.log("Access token obtained from Spotify:", data.access_token);
    console.log("Refresh token obtained from Spotify:", data.refresh_token);
    // Save the access token in the database
    const username = req.session.user; // Assuming the username is stored in the session
    console.log("Updating user", username, "with Spotify access token and refresh token");
    await db.query(
      "UPDATE users SET spotify_access_token = $1, spotify_refresh_token = $2 WHERE name = $3",
      [data.access_token, data.refresh_token, username]
    );

    res.redirect('/admin?message=spotifysuccess');
  } catch (err) {
    console.error("Failed to obtain access token from Spotify:", err);
    res.redirect('/admin?error=spotifyautherror');
  }


});

// Helper function to notify the requester of the song status
function notifyRequesterOfStatus(song, status) {
  sessionStore.get(song.requester_session_id, (err, session) => {
    if (err) {
      console.log("Error retrieving requester session from sessionStore");
      console.error(err);
      return;
    }

    if (session?.socketID) {
      const {socketID} = session;

      switch (status) {
        case "coming_up":
          Model.alertSongRequestComingUp(socketID);
          break;
        case "playing":
          Model.alertSongRequestPlaying(socketID);
          break;
        case "rejected":
          Model.alertSongRequestRejected(socketID);
          break;
        default:
          console.warn(`Unknown status "${status}" in notifyRequesterOfStatus`);
      }
    } else {
      console.log("Requester session not found, requester not alerted");
    }
  });
}

// Mark a song request as played:
router.post("/playsong", async (req, res) => {
  const { id } = req.body;
  console.log("Play song called for id:", id);

  const result = await db.query(
    "SELECT * FROM songrequests WHERE id=$1",
    [id]
  );
  const song = result.rows[0];

  // Check that song exists
  if (!song) {
    // Ogiltigt id, skicka 404
    res.status(404).send();
    return;
  }

  // console.log(song);
  // Säkertställ att användaren är inloggad som den användare vars song den försöker playa:
  if (song.dj_username !== req.session.user) {
    // Försöker playa någon annans song!
    res.status(401).send();
    return;
  }

  // Remove the song request:
  db.query(
    "DELETE FROM songrequests WHERE id=$1",
    [id]
  );

  // Notify requester of status
  notifyRequesterOfStatus(song, "playing");
  res.status(200).send();
});

// Mark a song as "coming up": (This is now used to queue a song in Spotify)
router.post("/comingup", async (req, res) => {
  const { id } = req.body;
  console.log("Coming up called for id:", id);

  const result = await db.query("SELECT * FROM songrequests WHERE id=$1", [id]);
  const song = result.rows[0];

  if (!song) {
    res.status(404).send();
    return;
  }

  if (song.dj_username !== req.session.user) {
    res.status(401).send();
    return;
  }

  // Get user's Spotify access token
  const res2 = await db.query(
    "SELECT spotify_access_token FROM users WHERE name=$1",
    [req.session.user]
  );
  let spotifyAccessToken = res2.rows[0]?.spotify_access_token;

  if (!spotifyAccessToken) {
    res.status(200).json({ songQueued: false, message: "User has not connected to Spotify. Please queue the song manually: " + song.song_title });
    return;
  }

  if (!song.song_spotify_id) {
    console.error("Song does not have a Spotify ID");
    res.status(200).json({ songQueued: false, message: "The song does not have a Spotify ID and cannot be queued in Spotify. Please queue the song manually: " + song.song_title });
    await db.query("UPDATE songrequests SET status='coming_up' WHERE id=$1", [id]);

    return;
  }

  // Try to queue the song
  const uri = `spotify:track:${song.song_spotify_id}`;
  const url = `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(uri)}`;

  const tryQueue = async (accessToken) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to queue song in Spotify:', errorData);

      if (response.status === 401) {
        // Token expired, try refreshing
        console.log('Access token expired, refreshing...');
        const newToken = await refreshSpotifyAccessToken(req.session.user);
        return tryQueue(newToken);
      }

      // Special case: No active device
      if (response.status === 404 && errorData.error.reason === "NO_ACTIVE_DEVICE") {
        return { success: false, reason: "NO_ACTIVE_DEVICE", message: errorData.error.message };
      }

      return { success: false, message: errorData.error.message };
    }

    return { success: true };
  };

  const queueResult = await tryQueue(spotifyAccessToken);

  if (!queueResult.success) {
    if (queueResult.reason === "NO_ACTIVE_DEVICE") {
      res.status(200).json({ songQueued: false, reason: "NO_ACTIVE_DEVICE", message: "No active Spotify device found. Start playing music in Spotify and try again." });
      return;
    }

    // For other errors, still mark the song as coming_up
    await db.query("UPDATE songrequests SET status='coming_up' WHERE id=$1", [id]);

    // Notify requester anyway
    notifyRequesterOfStatus(song, "coming_up");
    res.status(200).json({ songQueued: false, message: queueResult.message + ". Please queue manually: " + song.song_title });
    return;
  }

  // Success: update status and notify
  await db.query("UPDATE songrequests SET status='coming_up' WHERE id=$1", [id]);
  notifyRequesterOfStatus(song, "coming_up");
  res.status(200).json({ songQueued: true });
});

// Remove/Reject a song request:
router.post("/removesong", async (req, res) => {
  const { id } = req.body;
  console.log("Remove song called for id:", id);

  const result = await db.query(
    "SELECT * FROM songrequests WHERE id=$1",
    [id]
  );
  const song = result.rows[0];

  // Check that song exists
  if (!song) {
    // Ogiltigt id, skicka 404
    res.status(404).send();
    return;
  }

  // console.log(song);
  // Säkertställ att användaren är inloggad som den användare vars tid den försöker ta bort:
  if (song.dj_username !== req.session.user) {
    // Försöker ta bort någon annans tid eller tid som ej finns!
    res.status(401).send();
    return;
  }

  // Remove the song request:
  db.query(
    "DELETE FROM songrequests WHERE id=$1",
    [id]
  );
  
  // Retrieve websocket id of requester in order to alert them
  notifyRequesterOfStatus(song, "rejected");
  res.status(200).send();

});

export default { router };
