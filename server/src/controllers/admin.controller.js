import { Router } from "express";
import Model from "../model.js";
import Timeslot from "../models/timeslot.model.js";
import db from "../db.js";
import sessionStore from '../sessionStore.js'; // Import the session store

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
  req.session.authenticated = false;
  req.session.user = "";
  res.status(200).send();
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
  const songRequests = await db.all(
    'SELECT id, song_title, song_artist, request_date, status, dj_username FROM SongRequests WHERE dj_username = ?;',
    username
  );

  res.status(200).json({ songRequests });
});

// Mark a song request as played:
router.post("/playsong", async (req, res) => {
  const { id } = req.body;
  console.log("Play song called for id:", id);

  const song = await db.get("SELECT * FROM SongRequests WHERE id=?", [id]);

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
  db.run("DELETE FROM SongRequests WHERE id=?", [id]);

  // Retrieve websocket id of requester
  sessionStore.get(song.requester_session_id, (err, session) => {
    if (err) {
      console.log("Error retrieving requester session from sessionStore");
      console.error(err);
      res.status(200).send();
      return;
    }

    if (session && session.socketID) {
      const requesterWebsocketId = session.socketID;
      // Alert the requester of the song that it has been played:
      Model.alertSongRequestPlayed(requesterWebsocketId);
    } else {
      // Requester session not found
      console.log("Requester session not found, requester not alerted");
    }
    
    res.status(200).send();

  });
});

// Mark a song as "coming up":
router.post("/comingup", async (req, res) => {
  const { id } = req.body;
  console.log("Coming up called for id:", id);

  const song = await db.get("SELECT * FROM SongRequests WHERE id=?", [id]);

  // Check that song exists
  if (!song) {
    // Ogiltigt id, skicka 404
    res.status(404).send();
    return;
  }

  // console.log(song);
  // Säkertställ att användaren är inloggad som den användare vars song den försöker markera:
  if (song.dj_username !== req.session.user) {
    // Försöker markera någon annans song!
    res.status(401).send();
    return;
  }

  // Update the song request status to "coming_up":
  db.run("UPDATE SongRequests SET status='coming_up' WHERE id=?", [id]);

  // Retrieve websocket id of requestert in order to alert them
  sessionStore.get(song.requester_session_id, (err, session) => {
    if (err) {
      console.log("Error retrieving requester session from sessionStore");
      console.error(err);
      res.status(200).send();
      return;
    }

    if (session && session.socketID) {
      const requesterWebsocketId = session.socketID;
      // Alert the requester of the song that it is coming up:
      Model.alertSongRequestComingUp(requesterWebsocketId);
    } else {
      // Requester session not found
      console.log("Requester session not found, requester not alerted");
    }

    res.status(200).send();
  });

});

// Remove/Reject a song request:
router.post("/removesong", async (req, res) => {
  const { id } = req.body;
  console.log("Remove song called for id:", id);

  const song = await db.get("SELECT * FROM SongRequests WHERE id=?", [id]);

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
  db.run("DELETE FROM SongRequests WHERE id=?", [id]);

  // Retrieve websocket id of requester in order to alert them
  sessionStore.get(song.requester_session_id, (err, session) => {
    if (err) {
      console.log("Error retrieving requester session from sessionStore");
      console.error(err);
      res.status(200).send();
      return;
    }

    if (session && session.socketID) {
      const requesterWebsocketId = session.socketID;
      // Alert the requester of the song that it has been rejected:
      Model.alertSongRequestRejected(requesterWebsocketId);
    } else {
      // Requester session not found
      console.log("Requester session not found, requester not alerted");
    }

    res.status(200).send();
  });

});

export default { router };
