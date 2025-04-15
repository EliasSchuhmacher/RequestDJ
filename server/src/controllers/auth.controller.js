import { Router } from "express";
import bcrypt from "bcrypt";
import Model from "../model.js";
import db from "../dbPG.js";
import djUsers from '../djUsers.js';

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
//both for login and when created a new dj account
function handleLogin(req, res, username) {
  req.session.authenticated = true;
  req.session.user = username;

  req.session.save((error) => {
    if (error) {
      console.error("❌ Error saving session:", error);
      res.status(500).json({ message: "Error saving session" });
    } else {
      console.debug(`✅ Authenticated and saved session for ${username}`);

      // Set a frontend-readable cookie for landing page that cannot access  vuex store
      res.cookie("dj_logged_in", "true", {
        maxAge: 86400000,       // 1 day
        httpOnly: false,        // So frontend JS can read it
        sameSite: "lax",        // Prevent CSRF from other origins
        secure: false           // Set to true if using HTTPS
      });

      // Try to register socket if available
      const socketId = req.session.socketID;
      const io = req.app.get("io");
      const socket = io?.sockets?.sockets?.get(socketId);

      if (socket) {
        if (!djUsers.has(username)) {
          djUsers.set(username, []);
        }
        const socketList = djUsers.get(username);

        // Avoid pushing the same socket more than once
        if (!socketList.includes(socket)) {
          socketList.push(socket);
          console.log(`🎧 DJ ${username} socket registered on login/signup`);
        } else {
          console.log(`🔁 DJ ${username} socket already registered`);
        }
      } else {
        console.warn(`⚠️ No socket found for session ID: ${socketId}`);
      }

      // Return success
      res.status(200).json({ authenticated: true });
    }
  });
}

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
  const { rows } = await db.query(
    "SELECT password FROM users WHERE name=$1",
    [username]);
    const dbPassword = rows[0]?.password;

  // console.log(dbPassword);

  if (!dbPassword) {
    // User does not exist in the database bitch
    res.status(401).json({ authenticated: false });
    return;
  }

  bcrypt.compare(password, dbPassword, (err, result) => {
    if (result === true) {
      // Password matched! Let the user log in.
      console.log("password matched!");
      handleLogin(req, res, username); // ✅ Call your helper function here
  }});
});

router.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  // Verify request data
  if (!username || !password) {
    res.status(400).json({ message: "Request missing fields" });
    return;
  }

  // Check if the user already exists
  const result = await db.query(
    "SELECT name FROM users WHERE name=$1",
    [username]
  );
  const existingUser = result.rows[0];


  if (existingUser) {
    // User already exists bitch
    res.status(409).json({ message: "User already exists" });
    return;
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert the new user into the database
  await db.query(
    "INSERT INTO users (name, password) VALUES ($1, $2)",
    [username, hashedPassword]
  );

  // Authenticate the user
  handleLogin(req, res, username);
});

router.get("/sessionStatus", (req, res) => {
  Model.storeLongPollRequest(req.sessionID, req, res);
});

export default { router, requireAuth };
