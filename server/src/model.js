import db from "./db.js";
import djUsers from "./djUsers.js";

class Model {
  constructor() {
    this.io = undefined;
    this.sessionStore = undefined;
    this.reservationTimeouts = {};
    this.reservationTimeoutLength = 16 * 1000;
    this.sessionTimeouts = {};
    this.sessionTimeoutLength = 15 * 1000;
    this.longPollRequests = {};
    this.longPollInterval = 20 * 1000;
  }

  /**
   * Initialize the model after its creation.
   * @param {SocketIO.Server} io - The socket.io server instance.
   * @returns {void}
   */
  init(io, sessionStore) {
    this.io = io;
    this.sessionStore = sessionStore;
  }

  async removeReservation(timeslotId) {
    const timeslot = await db.get(
      "SELECT * from timeslots WHERE id=?",
      timeslotId
    );

    if (timeslot && timeslot.status === "Reserved") {
      db.run("UPDATE timeslots SET status='Available' WHERE id=?", [
        timeslotId,
      ]);

      // Broadcast the new updated timeslot object to all clients
      timeslot.status = "Available";
      this.broadcastUpdateTimeslot(timeslot);
    }

    console.log("RemoveReservation was called");
  }

  createReservationTimeout(timeslotId, sessionId) {
    this.reservationTimeouts[sessionId] = setTimeout(() => {
      this.removeReservation(timeslotId);
    }, this.reservationTimeoutLength);
    console.log(
      `New serverside reservation timeout was created with sessionId: ${sessionId}`
    );
  }

  cancelReservationTimeout(sessionId) {
    clearTimeout(this.reservationTimeouts[sessionId]);
    console.log(
      `Serverside reservation timeout was canceled with sessionId: ${sessionId}`
    );
  }

  createSessionTimeout(sessionId) {
    this.sessionTimeouts[sessionId] = setTimeout(() => {
      this.logoutSession(sessionId);
    }, this.sessionTimeoutLength);
    console.log("SessionTimeout was created for sessionId: ");
  }

  resetSessionTimeout(sessionId) {
    console.log("reset session timeout was called, sessionId:", sessionId);
    clearTimeout(this.sessionTimeouts[sessionId]);
    this.createSessionTimeout(sessionId);
  }

  logoutSession(sessionId) {
    console.log("logoutSession was called for sessionId: ", sessionId);
    this.sessionStore.get(sessionId, (err, session) => {
      const sessionCopy = session;
      sessionCopy.authenticated = false;
      sessionCopy.user = "";
      this.sessionStore.set(sessionId, sessionCopy, (error) => {
        if (error) {
          console.log(error);
        }
      });
    });
    // this.io.to(session.socketID).emit("inactivityLogout");
    this.logoutResponse(sessionId);
  }

  storeLongPollRequest(sessionId, req, res) {
    const longPoll = {
      request: req,
      response: res,
      timeoutFunction: setTimeout(() => {
        // Basic long-poll response (No new data):
        res.status(200).json({ hasValue: false });
      }, this.longPollInterval),
    };
    this.longPollRequests[sessionId] = longPoll;
    req.session.save((err) => {
      if (err) {
        console.log(err);
      }
    });
  }

  logoutResponse(sessionId) {
    if (!this.longPollRequests[sessionId]) {
      console.log("No pending ajax request from this user...");
      return;
    }

    // First cancel the basic response:
    clearTimeout(this.longPollRequests[sessionId].timeoutFunction);
    // Send logout response instead:
    const res = this.longPollRequests[sessionId].response;
    if (res) {
      res.status(200).json({ hasValue: true, message: "logout" });
    }
  }

  /**
   * Push out a message to all connected clients in the given room.
   * @param {Room} room - The room to add the message to.
   * @param {String} message - The message to add.
   * @returns {void}
   */
  broadcastUpdateTimeslot(timeslot) {
    this.io.emit("update", JSON.stringify(timeslot));
  }

  broadcastNewTimeslot(timeslot) {
    this.io.emit("new", JSON.stringify(timeslot));
  }

  broadcastNewSongRequest(songRequest) {
    const sockets = djUsers.get(songRequest.dj_username) || [];
  
    sockets.forEach(socket => {
      socket.emit("new", songRequest);
    });
  }

  broadcastRemoveTimeslot(id) {
    this.io.emit("remove", id);
  }

  alertSongRequestPlayed(id) {
    // Alert the socket with the id that the song has been played
    this.io.to(id).emit("played");
  }

  alertSongRequestComingUp(id) {
    // Alert the socket with the id that the song is coming up
    this.io.to(id).emit("coming_up");
  }

  alertSongRequestRejected(id) {
    // Alert the socket with the id that the song request was rejected
    this.io.to(id).emit("rejected");
  }

  /**
   * Join a specified room.
   * @param {String} socketID - An unique identifier for the user socket.io session.
   * @param {Room} room - The room to join.
   * @returns {void}
   */
  join(socketId, room) {
    this.io.in(socketId).socketsJoin(room.name);
  }
}

export default new Model();
