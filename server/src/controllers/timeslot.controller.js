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
    tokenExpiresAt = currentTime + data.expires_in * 1000 - 3 * 60 * 1000; // Refresh 3 min before actual expiry

    return cachedSpotifyToken;
  } catch (error) {
    console.error('Failed to get Spotify Access Token:', error);
    throw new Error('Unable to fetch Spotify Access Token');
  }
};

// Function to refresh a personal Spotify access token (not app token), throws an error if it fails so call needs to be inside try/catch
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

const fetchLastfmData = async (artist, track, fetchTrackOnly = false) => {
  const apiKey = process.env.LASTFM_API_KEY;
  const baseUrl = 'https://ws.audioscrobbler.com/2.0/';
  const format = 'json';

  // Always fetch track info
  const getTrackInfo = async () => {
    const url = `${baseUrl}?method=track.getInfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&format=${format}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Last.fm track.getInfo failed: ${res.statusText}`);
    return res.json();
  };

  // Optionally fetch artist info
  const getArtistInfo = async () => {
    const url = `${baseUrl}?method=artist.getInfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&format=${format}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Last.fm artist.getInfo failed: ${res.statusText}`);
    return res.json();
  };

  const trackInfo = await getTrackInfo();
  let artistInfo = null;

  if (!fetchTrackOnly) {
    artistInfo = await getArtistInfo();
  }

  // Extract top tags from track or fallback to artist (if available)
  const trackTags = trackInfo?.track?.toptags?.tag?.map(tag => tag.name) || [];
  const artistTags = artistInfo?.artist?.tags?.tag?.map(tag => tag.name) || [];

  const finalTags = trackTags.length > 0 ? trackTags : artistTags;

  return {
    tags: finalTags,
    trackWiki: trackInfo?.track?.wiki?.summary || null,
    artistWiki: artistInfo?.artist?.bio?.summary || null,
  };
};

// Function to fetch metadata for a song given its Spotify ID
const fetchSpotifySongMetadata = async (spotifyId) => {
  const accessToken = await getSpotifyAccessToken();
  try {
    // Step 1: Get basic track data
    const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!trackResponse.ok) {
      throw new Error(`Error fetching song metadata: ${trackResponse.statusText}`);
    }

    const trackData = await trackResponse.json();

    const {
      name: title,
      popularity,
      explicit,
      duration_ms,
      album,
      artists
    } = trackData;

    const artistNames = artists.map(artist => artist.name);
    const artistIds = artists.map(artist => artist.id);

    // Step 2: Get genres for each artist concurrently
    const genrePromises = artistIds.map(artistId =>
      fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
        .then(response => response.ok ? response.json() : null)
        .catch(error => {
          console.warn(`Failed to fetch artist metadata for artist ID ${artistId}:`, error);
          return null;
        })
    );

    const artistDataArray = await Promise.all(genrePromises);

    const genres = artistDataArray
      .filter(artistData => artistData) // Filter out null responses
      .flatMap(artistData => artistData.genres); // Extract genres

    // Remove duplicates
    const uniqueGenres = [...new Set(genres)];

    // Step 3: Last.fm API request for additional metadata
    let lastfmMetadata = {};
    try {
      lastfmMetadata = await fetchLastfmData(artistNames[0], title);
    } catch (error) {
      console.warn('Failed to fetch Last.fm metadata:', error);
    }

    return {
      title,
      artist: artistNames,
      album: album.name,
      imageUrl: album.images[0]?.url,
      popularity,
      duration: duration_ms / 1000, // Convert to seconds
      explicit,
      genres: uniqueGenres,
      lastfm: {
        tags: lastfmMetadata.tags,
        trackWiki: lastfmMetadata.trackWiki,
        artistWiki: lastfmMetadata.artistWiki
      }
    };
  } catch (error) {
    console.error('Failed to fetch Spotify song metadata:', error);
    throw new Error(`Failed to fetch Spotify song metadata: ${error.message}`);
  }
};

export const fetchRecentlyPlayedWithTags = async (username, limit = 4) => {
  // Get user's Spotify access token
  const result = await db.query(
    "SELECT spotify_access_token FROM users WHERE name=$1",
    [username]
  );
  const spotifyAccessToken = result.rows[0]?.spotify_access_token;

  if (!spotifyAccessToken) {
    throw new Error("User has not connected to Spotify");
  }

  // Fetch recently played tracks from Spotify
  const fetchTracks = async (token) => {
    const response = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, try to refresh
        const newToken = await refreshSpotifyAccessToken(username);
        return fetchTracks(newToken);
      }
      console.log("Failed to fetch recently played tracks, user has to update spotify permissions:", response.status, response.statusText);
      return [];
    }
    return response.json();
  };

  const data = await fetchTracks(spotifyAccessToken);

  // For each track, fetch Last.fm tags (in parallel, but only tags)
  const tracks = data.items.slice(0, limit).map(item => item.track);
  const results = await Promise.all(tracks.map(async (track) => {
    let tags = [];
    try {
      const lastfm = await fetchLastfmData(
        track.artists[0]?.name || "",
        track.name,
        true // Only fetch track info, not artist info
      );
      tags = lastfm.tags || [];
    } catch (e) {
      tags = [];
    }
    return {
      title: track.name,
      artists: track.artists.map(a => a.name),
      tags
    };
  }));
  
  console.log("Recently played tracks with tags:", results);

  return results;
};

// Function to evaluate a song using AI
const evaluateSongWithAI = async (songMetadata, recentlyPlayed, prompt) => {
  const {
    title,
    genres,
    duration,
    popularity,
    explicit,
    lastfm,
  } = songMetadata;

  // recentlyPlayed is expected to be an array of { title, artists, tags }
  const lastPlayedList = (recentlyPlayed || [])
    .map((track, idx) => 
      `${idx + 1}. "${track.title}" by ${track.artists.join(", ")} [tags: ${track.tags.join(", ")}]`
    ).join("\n    ");

  // Gather all unique tags from recently played tracks
  const allTags = [
    ...new Set(
      (recentlyPlayed || []).flatMap(track => track.tags || [])
    )
  ];

  const songString = `
    Title & Artist: ${title}
    Genre: ${genres?.join(", ") || "N/A"}
    Duration: ${duration || "N/A"} seconds
    Popularity: ${popularity || "N/A"} (0-100)
    Explicit: ${explicit ? "True" : "False"}
    Last.fm tags: ${lastfm?.tags?.join(", ") || "N/A"}
    Last.fm track wiki: ${lastfm?.trackWiki || "N/A"}
    Last.fm artist wiki: ${lastfm?.artistWiki || "N/A"}

    --- Recently Played Tracks (Most recent first) ---
    ${lastPlayedList || "N/A"}

    --- All Tags from Recently Played ---
    ${allTags.length > 0 ? allTags.join(", ") : "N/A"}
  `;

  console.log("Song String: ", songString);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: songString,
      config: {
        systemInstruction: prompt || process.env.AI_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            chainOfThought: { type: "string" },
            accepted: { type: "boolean" },
            reason: { type: "string" },
          },
          required: ["chainOfThought", "accepted", "reason"],
          propertyOrdering: ["chainOfThought", "accepted", "reason"]
        },
      },
    });

    console.log("AI response: ", response.text);

    // Parse the AI response as JSON
    const aiResponse = JSON.parse(response.text);
    return {
      accepted: aiResponse?.accepted,
      reason: aiResponse?.reason,
      chainOfThought: aiResponse?.chainOfThought,
    };
  } catch (error) {
    console.error("Failed to evaluate song with AI:", error);
    throw new Error("AI evaluation failed");
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

// Helper function to queue a song in Spotify, 
// This is called from the /comingup endpoint and also from the POST /songs endpoint if AI accepts the song
export const queueSongInSpotify = async (song, user) => {
  // Get user's Spotify access token
  const res2 = await db.query(
    "SELECT spotify_access_token FROM users WHERE name=$1",
    [user]
  );
  const spotifyAccessToken = res2.rows[0]?.spotify_access_token;

  if (!spotifyAccessToken) {
    return {
      success: false,
      message: `User has not connected to Spotify. Please queue the song manually: ${song.song_title}`,
    };
  }

  if (!song.song_spotify_id) {
    console.error("Song does not have a Spotify ID");
    return {
      success: false,
      message: `The song does not have a Spotify ID and cannot be queued in Spotify. Please queue the song manually: ${song.song_title}`,
    };
  }

  const uri = `spotify:track:${song.song_spotify_id}`;
  const url = `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(uri)}`;

  const tryQueue = async (accessToken) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to queue song in Spotify:", errorData);

      if (response.status === 401) {
        // Token expired, try refreshing
        console.log("Access token expired, refreshing...");
        const newToken = await refreshSpotifyAccessToken(user);
        return tryQueue(newToken);
      }

      // Special case: No active device
      if (response.status === 404 && errorData.error.reason === "NO_ACTIVE_DEVICE") {
        return {
          success: false,
          reason: "NO_ACTIVE_DEVICE",
          message: errorData.error.message,
        };
      }

      return { success: false, message: errorData.error.message };
    }

    return { success: true };
  };

  return tryQueue(spotifyAccessToken);
};

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

// Add a song request for a specific user:
router.post("/songs", async (req, res) => {
  console.log("✅ Received POST /api/songs");

  // song genre and requester_name defaults to empty string, if not provided
  const { DJ_name, song_spotify_id, requester_name = ''} = req.body;

  // Make sure DJ_name, song_spotify_id are supplied in request
  if (!DJ_name || !song_spotify_id) {
    // Invalid request, send response code 400;
    res.status(400).send();
    return;
  }

  // Fetch the song metadata from Spotify
  // eslint-disable-next-line one-var
  let songMetadata, song_title, song_artist, song_genre, song_image_url, song_popularity_score, song_explicit, song_duration, song_lastfmMetadata;
  try {
    songMetadata = await fetchSpotifySongMetadata(song_spotify_id);
    song_title = songMetadata.title;
    song_artist = songMetadata.artist.join(", ");
    const allGenres = [
      ...(songMetadata.lastfm.tags || []),
      ...(songMetadata.genres || [])
    ];
    const uniqueGenres = [...new Set(allGenres)];
    song_genre = uniqueGenres.join(", ");
    song_image_url = songMetadata.imageUrl;
    song_popularity_score = songMetadata.popularity;
  } catch (error) {
    console.error('Error fetching song metadata:', error);
    // Send a 500 error if the metadata fetch fails
    res.status(500).json({ message: "Failed to fetch song metadata" });
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
  let ai_accepted = null;
  let ai_reason = null;
  if (DJ.ai_mode && DJ.ai_mode === true) {
    try {
      const recentlyPlayed = await fetchRecentlyPlayedWithTags(DJ_name, 4);
      const aiEvaluation = await evaluateSongWithAI(songMetadata, recentlyPlayed, DJ.ai_prompt || process.env.AI_SYSTEM_INSTRUCTION);

      ai_accepted = aiEvaluation.accepted;
      ai_reason = aiEvaluation.reason;

      console.log("AI Accepted: ", ai_accepted);
      console.log("AI Reason: ", ai_reason);
    } catch (error) {
      console.error("Error during AI evaluation:", error);
      // Handle AI evaluation failure (optional)
      ai_accepted = null;
      ai_reason = "AI evaluation failed";
    }
  }

  // Automatically queue the song in Spotify if AI accepted it
  if (ai_accepted) {
    const song = {
      song_title,
      song_spotify_id
    };
    const queueResult = await queueSongInSpotify(song, DJ_name);

    if (!queueResult.success) {
      console.error("Failed to queue song:", queueResult.message);
      // Handle failure (e.g., notify the user)
    } else {
      console.log("Song successfully queued in Spotify");
    }
  }

  let status;
  if (ai_accepted === null) {
    status = "pending";
  } else if (ai_accepted === true) {
    status = "coming_up";
  } else {
    status = "rejected";
  }

  // Insert song request into database, status will default to "pending"
  const insertResult = await db.query(
    "INSERT INTO songrequests (DJ_username, song_title, song_artist, requester_session_id, requester_name, song_genre, song_spotify_id, song_image_url, song_popularity_score, ai_accepted, ai_reason, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *;",
    [DJ_name, song_title, song_artist, requester_session_id, requester_name, song_genre, song_spotify_id, song_image_url, song_popularity_score, ai_accepted, ai_reason, status]
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
    "SELECT id, song_title, song_artist, request_date, status, dj_username, requester_name, song_genre, ai_accepted, ai_reason FROM songrequests WHERE id = $1;",
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
