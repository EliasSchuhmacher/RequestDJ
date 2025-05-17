import { createStore } from "vuex";

export default createStore({
  state: {
    authenticated: false,
    username: "",
    timeslots: [],
    songRequests: [],
    spotifyQueue: [],
    currentlyPlaying: {},
    spotifyConnected: false,
    selectedBookingTimeslot: "",
    songRequestResponse: "",
    songRequestReason: "",
    lastFetchTimestamp: 0,
    // spotifyAccessToken: null,
  },
  getters: {
    isAuthenticated(state) {
      return state.authenticated;
    },
    getUsername(state) {
      return state.username;
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
    setSongRequests(state, songRequests) {
      state.songRequests = songRequests;
    },
    setSpotifyQueue(state, spotifyQueue) {
      console.log("Setting spotify queue in store to: ", spotifyQueue);
      state.spotifyQueue = spotifyQueue;
    },
    setCurrentlyPlaying(state, song) {
      state.currentlyPlaying = song;
    },
    addSpotifyQueue(state, song) {
      state.spotifyQueue.push(song);
    },
    setSpotifyConnected(state, connected) {
      state.spotifyConnected = connected;
    },
    setSelectedBookingTimeslot(state, timeslot) {
      state.selectedBookingTimeslot = timeslot;
    },
    setSongRequestResponse(state, response) {
      state.songRequestResponse = response;
      console.log("SongRequestResponse: ", response);
    },
    setSongRequestReason(state, reason) {
      state.songRequestReason = reason;
    },
    newSongRequest(state, songRequest) {
      // TODO: Send websocket message only to correct DJ instead of broadcasting
        console.log("new song request mutation")
        state.songRequests.unshift(songRequest);
    },
    removeSongRequest(state, id) {
      for (let i = 0; i < state.songRequests.length; i += 1) {
        if (state.songRequests[i].id === id) {
          state.songRequests.splice(i, 1);
          break;
        }
      }
    },
    sortSongRequests(state) {
      // Sort the song requests by timestamp
      state.songRequests.sort((a, b) => {
        const dateA = new Date(a.request_date);
        const dateB = new Date(b.request_date);
        return dateB - dateA; // Sort in descending order
      });
    },
    moveSongRequestToTop(state, id) {
      for (let i = 0; i < state.songRequests.length; i += 1) {
        if (state.songRequests[i].id === id) {
          const songRequest = state.songRequests.splice(i, 1)[0];
          state.songRequests.unshift(songRequest);
          break;
        }
      }
    },
    updateLastFetchTimestamp(state) {
      state.lastFetchTimestamp = Date.now();
    },
  },
  actions: {
    async fetchSongRequests({ commit, state }) {

      // Make sure the user is authenticated
      if (!state.authenticated) {
        console.log("User is not authenticated. Skipping fetch.");
        return;
      }

      const now = Date.now();
      const MIN_FETCH_INTERVAL = 5000; // ms

      if (now - state.lastFetchTimestamp < MIN_FETCH_INTERVAL) {
        console.log("Skipping fetch: too soon since last one.");
        return;
      }

      console.log("Fetching song requests...");
      commit("updateLastFetchTimestamp");

      try {
        const response = await fetch(`/api/songs/${state.username}`);
        const data = await response.json();
        commit("setSongRequests", data.songRequests);
        commit("sortSongRequests");
      } catch (error) {
        console.error("Error fetching song requests:", error);
      }
    },
  },
  modules: {},
});
