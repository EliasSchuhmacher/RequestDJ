import { createStore } from "vuex";

export default createStore({
  state: {
    authenticated: false,
    username: "",
    timeslots: [],
    songRequests: [],
    selectedBookingTimeslot: "",
  },
  getters: {
    isAuthenticated(state) {
      return state.authenticated;
    },
    getUsername(state) {
      return state.username;
    },
    getAssistantTimeslots(state) {
      return state.timeslots.filter((e) => e.assistantName === state.username);
    },
    getSongRequests(state) {
      return state.songRequests;
    }
  },
  mutations: {
    setAuthenticated(state, authenticated) {
      state.authenticated = authenticated;
    },
    setUsername(state, username) {
      state.username = username;
    },
    setTimeslots(state, timeslots) {
      state.timeslots = timeslots;
      state.timeslots.sort((a, b) => a.time.localeCompare(b.time));
    },
    setSongRequests(state, songRequests) {
      state.songRequests = songRequests;
    },
    setSelectedBookingTimeslot(state, timeslot) {
      state.selectedBookingTimeslot = timeslot;
    },
    bookSelectedTime(state, name) {
      this.selectedBookingTimeslot.bookedBy = name;
    },
    updateTimeslot(state, timeslot) {
      console.log("Websocket updateTimeslots shit has happened");
      console.log("new timeslot:");
      console.log(timeslot);
      console.log(state.timeslots);
      // New updated timeslot with same id is sent as paramenter
      for (let i = 0; i < state.timeslots.length; i += 1) {
        if (state.timeslots[i].id === timeslot.id) {
          state.timeslots[i] = timeslot; // Replace old timeslot-object by new one.
          break;
        }
      }
    },
    newTimeslot(state, timeslot) {
      state.timeslots.push(timeslot);
      // Sort by time:
      state.timeslots.sort((a, b) => a.time.localeCompare(b.time));
    },
    newSongRequest(state, songRequest) {
      // TODO: Send websocket message only to correct DJ instead of broadcasting
      console.log("New songrequest recieved from websocket")
      if (songRequest.dj_username === state.username) {
        state.songRequests.push(songRequest);
      }
    },
    removeTimeslot(state, id) {
      for (let i = 0; i < state.timeslots.length; i += 1) {
        if (state.timeslots[i].id === id) {
          state.timeslots.splice(i, 1);
          break;
        }
      }
    },
    removeSongRequest(state, id) {
      for (let i = 0; i < state.songRequests.length; i += 1) {
        if (state.songRequests[i].id === id) {
          state.songRequests.splice(i, 1);
          break;
        }
      }
    },
  },
  actions: {},
  modules: {},
});
