/* eslint-disable camelcase */
import { Router } from "express";
import Model from "../model.js";
import db from "../db.js";

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
    console.log('Spotify Access Token obtained successfully.', data);
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

// Add a song request for a specific user:
router.post("/songs", async (req, res) => {
  const { DJ_name, song_title, song_artist } = req.body;

  // Make sure DJ_name, song_name or artist are supplied in request
  if (!DJ_name || (!song_title && !song_artist)) {
    // Invalid request, send response code 400;
    res.status(400).send();
    return;
  }

  // Insert song request into database
  db.run("INSERT INTO SongRequests (DJ_username, song_title, song_artist) VALUES (?, ?, ?);", [DJ_name, song_title, song_artist]);

  // Retrieve the newly inserted song request
  const { newId } = await db.get("SELECT last_insert_rowid() AS newId;");
  const songRequest = await db.get("SELECT * FROM SongRequests WHERE id = ?;", [newId]);

  console.log(songRequest);

  // TODO: Send websocket message only to correct DJ instead of broadcasting
  Model.broadcastNewSongRequest(songRequest);

  // Choose the appropriate HTTP response status code and send an HTTP response, if any, back to the client
  res.status(200).end();
});

// Booking a time:
router.post("/timeslots", async (req, res) => {
  const { name, timeslotId } = req.body;
  console.log(timeslotId);

  // Make sure name and timeslotId are supplied in request
  if (!name || !timeslotId) {
    // Invalid request, send response code 400;
    res.status(400).send();
    return;
  }

  // Validate bookers name (Server side validation)
  if (validateBookersName(name) === false) {
    // Booking name doesn't meet critera, send response code 400.
    res.status(400).send();
    return;
  }

  // Validate that the user has previously reserved this timeslot:
  if (
    !(
      req.session.reservedTimeslotId &&
      req.session.reservedTimeslotId === timeslotId
    )
  ) {
    console.log("Stealing of another users reserved time was attempted");
    // Unauthorized to book timeslots that haven't been reserved by you
    res.status(401).send();
    return;
  }

  // Make sure that the timeslot is available and can be booked (Serverside check):
  const timeslot = await db.get(
    "SELECT * from timeslots WHERE id=?",
    timeslotId
  );

  if (timeslot && timeslot.status === "Reserved") {
    // Insert bookers name into timeslot and switch status to booked.
    db.run("UPDATE timeslots SET status='Booked', bookedBy=? WHERE id=?", [
      name,
      timeslotId,
    ]);

    // Broadcast the new updated timeslot object to all clients.
    timeslot.status = "Booked";
    timeslot.bookedBy = name;
    Model.broadcastUpdateTimeslot(timeslot);

    res.status(200).end();
  } else {
    // Forbidden request! Cannot book already booked/reserved timeslots.
    res.status(403).end();
  }
});

router.post("/reserve", async (req, res) => {
  const { timeslotId } = req.body;
  console.log(timeslotId);

  // Make sure that the timeslot is available and can be reserved (Serverside check):
  const timeslot = await db.get(
    "SELECT * from timeslots WHERE id=?",
    timeslotId
  );

  if (timeslot && timeslot.status === "Available") {
    // Change timeslot status to Reserved
    db.run("UPDATE timeslots SET status='Reserved' WHERE id=?", [timeslotId]);

    // Which timeslot the user has reserved should be saved in the users session data
    req.session.reservedTimeslotId = timeslotId;

    // Set timeout for server side reservation removal
    // Keep a reference to timeout function in session data, this allows us to cancel the timeout
    Model.createReservationTimeout(timeslotId, req.sessionID);

    // Broadcast the new updated timeslot object to all clients.
    timeslot.status = "Reserved";
    Model.broadcastUpdateTimeslot(timeslot);

    res.status(200).end();
  } else {
    // Forbidden request bitch! Cannot reserve already booked/reserved timeslots.
    res.status(403).end();
  }
});

router.post("/unreserve", async (req, res) => {
  const { timeslotId } = req.body;
  console.log(timeslotId);

  // Make sure that the timeslot is available and can be booked (Serverside check):
  const timeslot = await db.get(
    "SELECT * from timeslots WHERE id=?",
    timeslotId
  );

  if (timeslot && timeslot.status === "Reserved") {
    // Change timeslot status to Reserved
    db.run("UPDATE timeslots SET status='Available' WHERE id=?", [timeslotId]);

    // Reset session data about which timeslot the user has reserved.
    req.session.reservedTimeslotId = undefined;

    // Cancel the serverside reservation timeout for this timeslot
    Model.cancelReservationTimeout(req.sessionID);

    // Broadcast the new updated timeslot object to all clients.
    timeslot.status = "Available";
    Model.broadcastUpdateTimeslot(timeslot);

    res.status(200).end();
  } else {
    // Forbidden request! Cannot unreserve.
    res.status(403).end();
  }
});

export default { router };
