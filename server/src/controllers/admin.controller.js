import { Router } from "express";
import Model from "../model.js";
import Timeslot from "../models/timeslot.model.js";
import db from "../db.js";

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

const validateTime = (time) => {
  if (time.length !== 5) {
    // Invalid length of time string
    return false;
  }
  if (time[2] !== ":") {
    // Middle character needs to be " : "
    return false;
  }
  const hour = parseInt(time.slice(0, 2), 10); // Bas 10 (Decimal)
  const minute = parseInt(time.slice(3, 5), 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    // Invalid hour and minute number, needs to be in range 0-24:0-60
    return false;
  }
  // Passed all tests:
  return true;
};

router.post("/logout", async (req, res) => {
  console.log("Logout called on serverside");
  req.session.authenticated = false;
  req.session.user = "";
  res.status(200).send();
});

router.post("/newtime", async (req, res) => {
  const { time } = req.body;
  const username = req.session.user;

  if (!time) {
    // Request missing properties, don't let it crash the server
    res.send(400).send();
    return;
  }

  // Validate the time sent in request (Server side validation)
  if (validateTime(time) === false) {
    // Invalid time format, send response code 400.
    res.status(400).send();
    return;
  }

  await db.run(
    "INSERT INTO timeslots(time, assistantName, status, bookedBy) VALUES(?, ?, 'Available', '');",
    [time, username]
  );
  // Sqlite automatically asigns id to new insert, retrieve this:
  const { newId } = await db.get("SELECT last_insert_rowid() AS newId;");
  console.log(newId);

  const timeslot = new Timeslot(newId, time, username);

  // Message the clients:
  Model.broadcastNewTimeslot(timeslot);

  res.status(200).send();
});

// FIX ME!
router.post("/removetime", async (req, res) => {
  const { id } = req.body;
  console.log("Remove time called for id:", id);

  const timeslot = await db.get("SELECT * FROM timeslots WHERE id=?", [id]);

  console.log(timeslot);
  // Säkertställ att användaren är inloggad som den användare vars tid den försöker ta bort:
  if (!timeslot || timeslot.assistantName !== req.session.user) {
    // Försöker ta bort någon annans tid eller tid som ej finns!
    res.status(401).send();
    return;
  }

  // Remove the time:
  db.run("DELETE FROM timeslots WHERE id=?", [id]);

  // Message the clients:
  Model.broadcastRemoveTimeslot(id);
  res.status(200).send();
});

export default { router };
