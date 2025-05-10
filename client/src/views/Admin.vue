<template>
  <div class="row pt-sm-3 h-100">
  <!-- Error Alert -->
  <div v-if="spotifyErrorMessage" class="alert alert-danger alert-dismissible fade show overlay-alert" role="alert">
    {{ spotifyErrorMessage }}
    <button type="button" class="btn-close" aria-label="Close" @click="spotifyErrorMessage = ''"></button>
  </div>
  <div class="col-sm-6 d-flex flex-column custom-height pb-2 pb-sm-0">
    <h3 class="px-sm-5"> Incoming Requests </h3>
    <div class="overflow-auto px-sm-5 h-100">
      <transition-group name="slam" tag="div">
        <SongRequestCard
        v-for="songRequest in incomingSongRequests"
        :key="songRequest.id"
        :song-request="songRequest"
        :status="songRequest.status"
        :incoming="true"
        @set-playing="setPlaying"
        @submit-remove="submitRemove"
        @submit-comingup="submitComingUp"
        />
      </transition-group>
      <p
        v-if="incomingSongRequests.length === 0"
        class="lead fst-italic mt-3"
      >
        Waiting for requests, scan the QR code to send a song request...
      </p>
      <div class="py-4"></div>
    </div>
  </div>
  <div class="col-sm-6 d-flex flex-column custom-height">
    <div class="d-flex align-items-center px-sm-5">
      <h3>Song Queue</h3>
      <button type="button" class="btn p-0 ms-3 text-secondary" @click="getSpotifyQueue">
        <i class="fas fa-sync-alt"></i>
      </button>
    </div>
    <div class="overflow-auto px-sm-5 h-100">
      <transition-group name="slam" tag="div">
        <span v-if="$store.state.currentlyPlaying && $store.state.spotifyConnected" class="d-block mt-1 text-muted small">Currently Playing:</span>
        <SongQueueCard
        v-if="$store.state.currentlyPlaying && $store.state.spotifyConnected"
        :key="$store.state.currentlyPlaying.id"
        :song-request="$store.state.currentlyPlaying"
        :status="'coming_up'"
        :incoming="false"
        @set-playing="prevent"
        @submit-remove="prevent"
        @submit-comingup="prevent"
        />
        <span v-if="$store.state.spotifyQueue.length > 0" class="d-block mt-2 text-muted small">Coming Up:</span>
        <SongQueueCard
        v-for="song in $store.state.spotifyQueue"
        :key="song.id"
        :song-request="song"
        :status="'queued'"
        :incoming="false"
        @set-playing="prevent"
        @submit-remove="prevent"
        @submit-comingup="prevent"
        />
      </transition-group>
      <button v-if="!$store.state.spotifyConnected" type="button" class="btn btn-success w-100 mt-2 mb-3 bg-green-custom" @click="connectToSpotify">Connect to Spotify</button>
      <div v-if="$store.state.spotifyConnected" class="d-flex justify-content-between align-items-center">
        <p class="text-muted text-small">Connected to Spotify</p>
        <p class="btn p-0 text-muted text-small" @click="spotifyDisconnect">Disconnect</p>
      </div>
      <!-- <button v-else type="button" class="btn btn-success w-100 mt-2 bg-green-custom" @click="connectToSpotify">Refresh Spotify Connection</button> -->
      <!-- <p v-if="spotifyErrorMessage" class="text-muted text-small mt-2">{{ spotifyErrorMessage }}</p> -->
    </div>
    <!-- <div class="overflow-auto px-sm-5 h-100">
      <transition-group name="slam" tag="div">
        <SongRequestCard
          v-for="songRequest in acceptedSongRequests"
          :key="songRequest.id"
          :song-request="songRequest"
          :status="songRequest.status"
          :incoming="false"
          @set-playing="setPlaying"
          @submit-remove="submitRemove"
          @submit-comingup="submitComingUp"
        />
      </transition-group>
      <div class="py-4"></div>
    </div> -->
  </div>
</div>
</template>

<script>
import SongRequestCard from "../components/SongRequestCard.vue";
import SongQueueCard from "../components/SongQueueCard.vue";

export default {
  name: "AdminView",
  components: {
    SongRequestCard,
    SongQueueCard,
  },
  data: () => ({
    newtime: "10:00",
    intervalId: null,
    spotifyQueueRefreshInterval: 1000 * 15, // 15 seconds
    spotifyErrorMessage: "",
    // TODO: save id of last song request
  }),
  computed: {
    sortedSongRequests() {
      // No longer used
      return this.$store.state.songRequests.slice().sort((a, b) => {
        if (a.status === 'coming_up' && b.status !== 'coming_up') {
          return -1;
        }
        if (a.status !== 'coming_up' && b.status === 'coming_up') {
          return 1;
        }
        return 0;
      });
    },
    acceptedSongRequests() {
      return this.$store.state.songRequests.filter(request => request.status !== 'pending').reverse();
    },
    incomingSongRequests() {
      return this.$store.state.songRequests.filter(request => request.status === 'pending');
    },
  },
  async mounted() {
    const { commit, dispatch } = this.$store;

    // Fetch the song requests from the server
    dispatch("fetchSongRequests");

    // Add event listener on window focus
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    
    // Check if the user has connected to Spotify
    const spotifyRes = await fetch(`/api/checkspotifyconnected`);
    const { connected } = await spotifyRes.json();
    if (connected) {
      this.getSpotifyQueue();
      // Commit to store
      commit("setSpotifyConnected", true);
      this.startPolling();
    }

  },
  beforeUnmount() {
    this.stopPolling();
    document.removeEventListener("visibilitychange", this.handleVisibilityChange); // Clean up event listener
  },
  methods: {
    prevent() {
      // Do nothing
    },
    redirect(name) {
      this.$router.push(`/rooms/${name}`);
    },
    connectToSpotify() {
      // Redirect to the Spotify login page
      window.location.href = "/api/spotifylogin";
    },
    // No longer used, moved to store
    // fetchSongRequests() {
    //   // Fetch the song requests from the server
    //   fetch(`/api/songs/${this.$store.state.username}`)
    //     .then((res) => res.json())
    //     .then((data) => {
    //       this.$store.commit("setSongRequests", data.songRequests);
    //       this.$store.commit("sortSongRequests");
    //     })
    //     .catch((err) => {
    //       console.error("Error fetching song requests:", err);
    //       this.spotifyErrorMessage = `An error occurred while fetching song requests. ${err.message}`;
    //     });
    // },
    spotifyDisconnect() {
      // Disconnect the Spotify account
      fetch("/api/spotifydisconnect", {
        method: "POST",
      })
        .then((res) => {
          if (res.ok) {
            // If the response status is 200 OK
            this.$store.commit("setSpotifyConnected", false);
            this.$store.commit("setSpotifyQueue", []);
            this.$store.commit("setCurrentlyPlaying", {});
            this.stopPolling();
            this.spotifyErrorMessage = "Successfully disconnected from Spotify.";
          } else {
            // Handle non-200 responses
            this.spotifyErrorMessage = "Failed to disconnect from Spotify.";
          }
        })
        .catch((err) => {
          console.error("Error disconnecting from Spotify:", err);
          this.spotifyErrorMessage = `An error occurred while disconnecting from Spotify. ${err.message}`;
        });
    },
    handleVisibilityChange() {
      // Fetch the song requests when the window is focused
      if (document.visibilityState === "visible") {
        this.$store.dispatch("fetchSongRequests");
        console.log("Window focused, fetching song requests...");
      }
    },
    handleLoggedOutResponse(){
      // Handle the response when the user is logged out and redirect to login
      this.$store.commit("setAuthenticated", false);
      this.$store.commit("setUsername", "");
      this.$store.commit("setSongRequests", []);
      this.$store.commit("setSpotifyQueue", []);
      this.$store.commit("setCurrentlyPlaying", {});
      this.$store.commit("setSpotifyConnected", false);
      // this.$router.push("/login");
      window.location.href = "/login"; // Redirect to login page, forcing a full page reload
    },
    getSpotifyQueue() {
      // Check if the user is connected to Spotify
      if (!this.$store.state.spotifyConnected) {
        // Cancel the interval polling
        this.stopPolling();
        return;
      }

      // Fetch the Spotify queue
      fetch(`/api/spotifyqueue/${this.$store.state.username}`, {
        method: "GET",
      })
        .then((res) => {
          if (!res.ok) {
            return res.json().then((errorData) => {
              const error = errorData.message || `HTTP error! status: ${res.status}`;

              console.log(errorData);
              // Handle 401 Unauthorized with redirect to login
              if (res.status === 401 && errorData.redirect === "login") {
                console.info("Session expired or user not logged in. Redirecting to login...");
                this.handleLoggedOutResponse(); // Redirect to login
                return;
              }

              // Handle other auth-related errors
              if (res.status === 401 || res.status === 403) {
                this.$store.commit("setSpotifyConnected", false);
              }

              throw new Error(error);
            });
          }
          return res.json();
        })
        .then((data) => {
          console.log("Spotify Queue: ", data);
          // Commit to store
          if (data.spotifyQueue.queue) {
            const queue = data.spotifyQueue.queue?.map((song) => ({
              song_title: song.name,
              song_artist: song.artists?.map((artist) => artist.name).join(", ") || "",
              song_spotify_id: song.id,
              song_image_url: song.album?.images.at(-1)?.url || "",
            }));
            this.$store.commit("setSpotifyQueue", queue);
          } else {
            this.$store.commit("setSpotifyQueue", []);
          }

          if (data.spotifyQueue.currently_playing) {
            const { name, id, artists } = data.spotifyQueue.currently_playing;
            this.$store.commit("setCurrentlyPlaying", {
              song_title: name,
              song_artist: artists?.map((artist) => artist.name).join(", ") || "",
              song_spotify_id: id,
              song_image_url: data.spotifyQueue.currently_playing.album?.images.at(-1)?.url || "",
            });
          } else {
            this.$store.commit("setCurrentlyPlaying", undefined);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch Spotify queue:", err);
          this.spotifyErrorMessage = err.message || "Failed to fetch Spotify queue";
          // Don't assume disconnection here — handled above based on status code
        });
    },
    startPolling() {
      this.getSpotifyQueue(); // Initial fetch
      this.intervalId = setInterval(this.getSpotifyQueue, this.spotifyQueueRefreshInterval); // Fetch every 15 seconds
    },
    stopPolling() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    },
    submitRemove(id) {
      // Remove the song request from the store
      this.$store.commit("removeSongRequest", id);

      fetch("/api/removesong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(console.error);
    },
    updateStatus(id, status) {
      // Find the song request by id and update its status
      const songRequest = this.$store.state.songRequests.find(sr => sr.id === id);
      if (songRequest) {
        songRequest.status = status;
      }
    },
    setPlaying(id) {
      this.updateStatus(id, 'playing');

      // TODO add ability to cancel the playing status
      // Wait 1.5 seconds before removing the song request
      const timeDelay = 2400; // Needs to be slighlty shorter than animation duration?
      setTimeout(() => this.submitPlaying(id), timeDelay);
    },
    submitComingUp(id) {
      fetch("/api/comingup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (!data.songQueued) {
            if (data.reason === "NO_ACTIVE_DEVICE") {
              console.warn("No active Spotify device:", data.message);
              this.spotifyErrorMessage = "Please start playing music in Spotify to queue songs.";
              return;
            }

            // For all other failure reasons, proceed with UI/store update anyway
            console.warn("Spotify queuing failed:", data.message);
            this.spotifyErrorMessage = `Warning: ${data.message}`;
          }

          // Mark as accepted in the store & UI regardless of Spotify queue result,
          // unless NO_ACTIVE_DEVICE
          this.updateStatus(id, 'coming_up');
          this.$store.commit("moveSongRequestToTop", id);

          // Optionally refresh the Spotify queue
          setTimeout(() => this.getSpotifyQueue(), 250);
        })
        .catch((error) => {
          console.error("Error in submitComingUp:", error.message);
          this.spotifyErrorMessage = "An error occurred while processing the request.";
        });
    },
    submitPlaying(id) {
      // Remove the song request from the store
      this.$store.commit("removeSongRequest", id);

      fetch("/api/playsong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(console.error);
    },
  },
};
</script>

<style scoped>
.slam-enter-active {
  animation: slam-in 0.5s ease-out;
}
.custom-height {
  height: 50%;
}
.overlay-alert {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1050; /* Ensure it appears above other elements */
  max-width: 90%; /* Adjust width for responsiveness */
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

@media (min-width: 576px) {
  .custom-height {
    height: 100%;
  }
}
@keyframes slam-in {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  70% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}
</style>