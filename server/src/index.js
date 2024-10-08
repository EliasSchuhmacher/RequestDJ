import betterLogging from "better-logging";
import express from "express";
import expressSession from "express-session";
import socketIOSession from "express-socket.io-session";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from 'dotenv'; // kör npm install
import { resolvePath } from "./util.js";
import Model from "./model.js";
import admin from "./controllers/admin.controller.js";
import auth from "./controllers/auth.controller.js";
import timeslot from "./controllers/timeslot.controller.js";
import sessionStore from './sessionStore.js'; // Import the session store


// Load environment variables from .env file
dotenv.config();

import db from './dbPG.js';


const port = process.env.PORT || 8989;
const app = express();
const server = createServer(app);
const io = new Server(server);

// Connectt to the database
db.connect().then(() => {
  console.log('Connected to PostgreSQL database');
})
.catch((err) => {
  console.error('Error connecting to PostgreSQL database', err);
});;


// const sessionStore = new expressSession.MemoryStore();

const { Theme } = betterLogging;
betterLogging(console, {
  color: Theme.green,
});

// Enable debug output
console.logLevel = 4;

// Register a custom middleware for logging incoming requests
app.use(
  betterLogging.expressMiddleware(console, {
    ip: { show: true, color: Theme.green.base },
    method: { show: true, color: Theme.green.base },
    header: { show: false },
    path: { show: true },
    body: { show: true },
  })
);

// Configure session management
const sessionConf = expressSession({
  secret: "Super secret! Shh! Do not tell anyone...",
  resave: false,
  saveUninitialized: true,
  store: sessionStore,
  cookie: { maxAge: 86400000 },
});

app.use(sessionConf);
io.use(
  socketIOSession(sessionConf, {
    autoSave: true,
    saveUninitialized: false,
  })
);

// Serve static files
app.use(express.static(resolvePath("client", "dist")));

// Register middlewares that parse the body of the request, available under req.body property
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Bind REST controllers to /api/*
app.use("/api", timeslot.router);
app.use("/api", auth.router);
app.use("/api", auth.requireAuth(sessionStore), admin.router);

// app.use("/api", admin.requireAuth, chat.router);

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

  // This part needs to be last?:
  session.save((err) => {
    if (err) console.error(err);
    else {
      console.log("sessionID: ", sessionID);
      console.debug(`Saved socketID: ${session.socketID}`)};
  });

  // BONUS 4X (Inactivity handling using socket.io):
  // Cancel server session timeout on every "activity" message from client:
  // socket.on("message", (data) => {
  //   console.log("data in websocket message: ", data);
  //   if (data === "activity") {
  //     console.log("activity notification recieved from client");
  //     Model.resetSessionTimeout(sessionID, session);
  //   }
  // });
});

server.listen(port, () => {
  console.log(`Listening on http://localhost:${port}/`);
});

export default io;
