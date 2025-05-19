import betterLogging from "better-logging";
import express from "express";
import expressSession from "express-session";
import socketIOSession from "express-socket.io-session";
import { createServer } from "http";
import { Server } from "socket.io";
import './dotenv.js'; // kör npm install
import { resolvePath } from "./util.js";
import Model from "./model.js";
import admin from "./controllers/admin.controller.js";
import auth from "./controllers/auth.controller.js";
import { router as timeslotRouter } from "./controllers/timeslot.controller.js";
import sessionStore from './sessionStore.js'; // Import the session store
import db from './dbPG.js';
import djUsers from "./djUsers.js";


const port = process.env.PORT || 8989;
const app = express();
const server = createServer(app);
const io = new Server(server);

//make IO accessible from controllers
app.set("io", io);

// Connectt to the database
db.connect()
  .then(() => console.log('✅ Connected to PostgreSQL database'))
  .catch((err) => {
    console.error('❌ Error connecting to PostgreSQL database:', err.message || err);
  });


// const sessionStore = new expressSession.MemoryStore();

const { Theme } = betterLogging;
betterLogging(console, {
  color: Theme.green,
});

// Enable debug output
console.logLevel = 4;

// Register a custom middleware for logging incoming requests
app.use((req, res, next) => {
  if (req.method !== "GET") {
    betterLogging.expressMiddleware(console, {
      ip: { show: true, color: Theme.green.base },
      method: { show: true, color: Theme.green.base },
      header: { show: false },
      path: { show: true },
      body: { show: true },
    })(req, res, next);
  } else {
    next(); // Skip logging for GET requests
  }
});

// Configure session management
const sessionConf = expressSession({
  secret: process.env.SESSION_SECRET || "Super secret! Shh! Do not tell anyone...",
  resave: false,
  saveUninitialized: true,
  store: sessionStore,
  // cookie: { maxAge: 6 * 60 * 60 * 1000 }, // 6 hours
  cookie: { maxAge: 48 * 60 * 60 * 1000 }, // 48 hours
});

app.use(sessionConf);
io.use(
  socketIOSession(sessionConf, {
    autoSave: true,
    saveUninitialized: false,
  })
);

// Log requests to /requestsong/:username
app.get("/requestsong/:username", (req, res, next) => {
  const { username } = req.params;
  if (username) {
    console.log(`QR code scanned for username: ${username}`);
  }
  // Pass the request to the Vue Router handler
  next();
});

// Serve the landing page for the root URL
app.use('/', express.static(resolvePath("client", "public", "landing")));

// Serve static files
app.use(express.static(resolvePath("client", "dist")));

// Register middlewares that parse the body of the request, available under req.body property
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Bind REST controllers to /api/*
app.use("/api", timeslotRouter);
app.use("/api", auth.router);
app.use("/api", auth.requireAuth(sessionStore), admin.router);

// Redirect invalid requests to starting page
// app.use("*", (req, res) => {
//   res.redirect("/");
// });

app.get('*', (req, res) => {
  res.sendFile(resolvePath('client', 'dist', 'index.html'));
});

// Initalize timeslots model
Model.init(io, sessionStore);

// Handle socket.io connections
io.on("connection", (socket) => {
  const { session, sessionID } = socket.handshake;
  session.socketID = socket.id;
  const username = session.user;

  session.save((err) => {
    if (err) {
      console.error("Session save error:", err);
      return;
    }

    if (username) {
      if (!djUsers.has(username)) {
        djUsers.set(username, []);
      }
      const socketList = djUsers.get(username);
      // Check if this socket is already registered
      if (!socketList.includes(socket)) {
        socketList.push(socket);
      }
      console.log(`New WS connection for DJ: ${username} (sessionID: ${sessionID})`);
    } else {
      // console.log("WebSocket connection without an authenticated user (QR code scan)");
    }
  });
});

server.listen(port, () => {
  console.log(`Listening on http://localhost:${port}/`);
});

export default io;
