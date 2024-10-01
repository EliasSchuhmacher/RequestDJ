import { Router } from "express";
import bcrypt from "bcrypt";
import Model from "../model.js";
import db from "../db.js";

const router = Router();

/**
 * API (see the route handlers below) should combine uniquely identifiable resources (paths)
 * with the appropriate HTTP request methods (GET, POST, PUT, DELETE and more) to manipulate them.
 *
 * POST    /login                       =>  Try to login with details supplied in request body
 * GET     /users/me                    =>  Get current session details, authenticated and username
 * etc.
 */

/**
 * requireAuth is a middleware function that limit access to an endpoint to authenticated users.
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 * @returns {void}
 */
const requireAuth = (sessionStore) => (req, res, next) => {
  // Try using sessionStore.get instead, (Problem with req.session on parallel requests...):
  sessionStore.get(req.sessionID, (err, session) => {
    if (session && session.authenticated === true) {
      // User is authenticated! Go ahead!
      next();
    } else {
      // USER SESSION NOT AUTHENTICATED
      res.status(401).end();
    }
  });
};

router.get("/users/me", (req, res) => {
  // console.log(req.session);
  res.status(200).json({
    authenticated: req.session.authenticated,
    username: req.session.user,
  });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // Check the database for password match: Use bcrypt later on
  const dbPassword = await db.get(
    "SELECT password FROM assistants WHERE name=?",
    username
  );

  // console.log(dbPassword);

  if (!dbPassword) {
    // User does not exist in the database bitch
    res.status(401).json({ authenticated: false });
    return;
  }

  bcrypt.compare(password, dbPassword.password, (err, result) => {
    if (result === true) {
      // Password matched! Let the user log in.
      console.log("password matched!");
      req.session.authenticated = true;
      req.session.user = username;

      // Start a session timeout timer:
      // Model.resetSessionTimeout(req.sessionID, req.session);

      req.session.save((error) => {
        if (error) console.error(error);
        else console.debug(`Saved and authenticated user: ${username}`);
      });
      res.status(200).json({ authenticated: true });
    } else {
      // Invalid credentials bitch
      res.status(401).json({ authenticated: false });
    }
  });
});

router.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  // Verify request data
  if (!username || !password) {
    res.status(400).json({ message: "Request missing fields" });
    return;
  }

  // Check if the user already exists
  const existingUser = await db.get(
    "SELECT name FROM assistants WHERE name=?",
    username
  );

  if (existingUser) {
    // User already exists bitch
    res.status(409).json({ message: "User already exists" });
    return;
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert the new user into the database
  await db.run(
    "INSERT INTO assistants (name, password) VALUES (?, ?)",
    [username, hashedPassword]
  );

  // Authenticate the user
  req.session.authenticated = true;
  req.session.user = username;

  req.session.save((error) => {
    if (error) {
      console.error(error);
      res.status(500).json({ message: "Error saving session" });
    } else {
      console.debug(`Saved and authenticated new user: ${username}`);
      res.status(201).json({ authenticated: true });
    }
  });
});

router.get("/sessionStatus", (req, res) => {
  Model.storeLongPollRequest(req.sessionID, req, res);
});

export default { router, requireAuth };
