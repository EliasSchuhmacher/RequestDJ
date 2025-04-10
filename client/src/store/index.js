import { createStore } from "vuex";

export default createStore({
  state: {
    authenticated: false,
    username: "",
    timeslots: [],
    songRequests: [],
    spotifyQueue: [],
    currentlyPlaying: undefined,
    spotifyConnected: false,
    selectedBookingTimeslot: "",
    songRequestResponse: "",
    //spotifyAccessToken: null,
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
    bookSelectedTime(state, name) {
      this.selectedBookingTimeslot.bookedBy = name;
    },
    newSongRequest(state, songRequest) {
      // TODO: Send websocket message only to correct DJ instead of broadcasting
        console.log("new song request mutation")
        state.songRequests.push(songRequest);
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
      state.songRequests.slice().sort((a, b) => {
        if (a.status === 'coming_up' && b.status !== 'coming_up') {
          return -1;
        }
        if (a.status !== 'coming_up' && b.status === 'coming_up') {
          return 1;
        }
        return 0;
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
    }
  },
  actions: {},
  modules: {},
});
