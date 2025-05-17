<template>
  <div class="row pt-sm-3 h-100">
  <!-- Error Alert -->
  <div v-if="spotifyErrorMessage" class="alert alert-danger alert-dismissible fade show overlay-alert" role="alert">
    {{ spotifyErrorMessage }}
    <button type="button" class="btn-close" aria-label="Close" @click="spotifyErrorMessage = ''"></button>
  </div>

  <div class="col-sm-6 d-flex flex-column custom-height pb-2 pb-sm-0">
    <div class="d-flex flex-wrap align-items-center px-sm-5">
      <h3 class="me-auto">Incoming Requests</h3>
    </div>
    <div class="d-flex flex-wrap align-items-center px-sm-5 mb-2">
      <!-- Accepting Requests Toggle -->
      <div class="d-flex align-items-center me-auto mb-2 mb-sm-0">
        <span class="text-muted text-small">Allow Requests:</span>
        <button
          type="button"
          class="btn btn-sm btn-toggle"
          data-toggle="button"
          :class="{ active: currentlyAccepting }"
          aria-pressed="currentlyAccepting"
          @click="toggleAcceptingRequests"
        >
          <div class="handle"></div>
        </button>
      </div>

      <!-- AI Mode Toggle -->
      <div class="d-flex align-items-center">
        <span class="text-muted text-small">AI Mode:</span>
        <button
          type="button"
          class="btn btn-sm btn-toggle"
          data-toggle="button"
          :class="{ active: aiModeEnabled }"
          aria-pressed="aiModeEnabled"
          @click="toggleAIMode"
        >
          <div class="handle"></div>
        </button>
        <button
          type="button"
          class="btn p-0 text-secondary"
          data-bs-toggle="modal"
          data-bs-target="#aiSettingsModal"
        >
          <i class="fas fa-cog"></i>
        </button>
      </div>
    </div>
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
  </div>

  <AIModal/>
</div>
</template>

<script>
import SongRequestCard from "../components/SongRequestCard.vue";
import SongQueueCard from "../components/SongQueueCard.vue";
import AIModal from "../components/AIModal.vue";

export default {
  name: "AdminView",
  components: {
    SongRequestCard,
    SongQueueCard,
    AIModal,
  },
  data: () => ({
    currentlyAccepting: true,
    aiModeEnabled: false,
    customAIPrompt: "",
    intervalId: null,
    spotifyQueueRefreshInterval: 1000 * 15, // 15 seconds
    spotifyErrorMessage: "",
    // TODO: save id of last song request
  }),
  computed: {
    incomingSongRequests() {
      return this.$store.state.songRequests.filter(
        request => request.status === 'pending' || request.ai_accepted !== null
      );
    },
  },
  async mounted() {
    const { commit, dispatch } = this.$store;

    // Fetch the song requests from the server
    dispatch("fetchSongRequests");

    // Fetch the accepting status from the server
    this.fetchAcceptingStatus();

    // Fetch the AI mode status from the server
    this.fetchAIModeStatus();

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
    async fetchAcceptingStatus() {
      try {
        const response = await fetch("/api/check_dj_status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ DJ_name: this.$store.state.username }),
        });

        if (response.status === 200) {
          // DJ is accepting requests
          const data = await response.json();
          this.currentlyAccepting = true;
          console.log(data.message); // "DJ is accepting requests"
        } else if (response.status === 403) {
          // DJ is not accepting requests
          const data = await response.json();
          this.currentlyAccepting = false;
          console.log(data.message); // "DJ is not accepting requests"
        } else {
          // Handle unexpected responses
          console.error("Unexpected response:", response);
        }
      } catch (error) {
        console.error("Error fetching accepting status:", error);
      }
    },
    async fetchAIModeStatus() {
      try {
        const response = await fetch("/api/aimode/status", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const data = await response.json();
          this.aiModeEnabled = data.ai_mode;
          console.log("AI Mode Status:", data.ai_mode ? "Enabled" : "Disabled");
        } else {
          console.error("Failed to fetch AI mode status");
          this.spotifyErrorMessage = "Failed to fetch AI mode status.";
        }
      } catch (error) {
        console.error("Error fetching AI mode status:", error);
        this.spotifyErrorMessage = "An error occurred while fetching AI mode status.";
      }
    },
    async toggleAcceptingRequests() {
      try {
        const response = await fetch("/api/acceptingrequests/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currently_accepting: !this.currentlyAccepting }),
        });

        if (response.ok) {
          const data = await response.json();
          this.currentlyAccepting = data.currently_accepting; // Update based on server response
          console.log(data.message);
        } else {
          const errorData = await response.json();
          console.error("Failed to toggle accepting requests:", errorData.message);
          this.spotifyErrorMessage = errorData.message || "Failed to toggle accepting requests.";
        }
      } catch (error) {
        console.error("Error toggling accepting requests:", error);
        this.spotifyErrorMessage = "An error occurred while toggling accepting requests.";
      }
    },
    async toggleAIMode() {
      try {
        const response = await fetch("/api/aimode/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ai_mode: !this.aiModeEnabled }),
        });

        if (response.ok) {
          const data = await response.json();
          this.aiModeEnabled = data.ai_mode; // Update based on server response
          console.log(data.message);
        } else {
          const errorData = await response.json();
          console.error("Failed to toggle AI mode:", errorData.message);
          this.spotifyErrorMessage = errorData.message || "Failed to toggle AI mode.";
        }
      } catch (error) {
        console.error("Error toggling AI mode:", error);
        this.spotifyErrorMessage = "An error occurred while toggling AI mode.";
      }
    },
    saveAIPrompt(prompt) {
      console.log("Saving AI Prompt:", prompt);
      // Logic for saving the AI prompt
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

/* CUSTOM TOGGLE BUTTON */
/* Colors */
:root {
  --brand-primary: #29b5a8;
  --gray: #6b7381;
  --gray-light: #8a919f; /* lighten(@gray, 15%) */
  --gray-lighter: #a9afb9; /* lighten(@gray, 30%) */

  /* Button Colors */
  --btn-default-color: var(--gray);
  --btn-default-bg: var(--gray-lighter);

  /* Toggle Sizes */
  --toggle-default-size: 1.5rem;
  --toggle-default-label-width: 4rem;
  --toggle-default-font-size: 0.75rem;
}
/* Toggle Button Colors */
.btn-toggle {
  margin: 0 4rem;
  padding: 0;
  position: relative;
  border: none;
  height: 1.5rem;
  width: 3rem;
  border-radius: 1.5rem;
  color: #6b7381;
  background: #bdc1c8;
}
.btn-toggle:focus,
.btn-toggle.focus,
.btn-toggle:focus.active,
.btn-toggle.focus.active {
  outline: none;
}
.btn-toggle:before,
.btn-toggle:after {
  line-height: 1.5rem;
  width: 4rem;
  text-align: center;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 2px;
  position: absolute;
  bottom: 0;
  transition: opacity 0.25s;
}
.btn-toggle:before {
  content: 'No';
  left: -4rem;
}
.btn-toggle:after {
  content: 'Yes';
  right: -4rem;
  opacity: 0.5;
}
.btn-toggle > .handle {
  position: absolute;
  top: 0.1875rem;
  left: 0.1875rem;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 1.125rem;
  background: #fff;
  transition: left 0.25s;
}
.btn-toggle.active {
  transition: background-color 0.25s;
}
.btn-toggle.active > .handle {
  left: 1.6875rem;
  transition: left 0.25s;
}
.btn-toggle.active:before {
  opacity: 0.5;
}
.btn-toggle.active:after {
  opacity: 1;
}
.btn-toggle.btn-sm:before,
.btn-toggle.btn-sm:after {
  line-height: -0.5rem;
  color: #fff;
  letter-spacing: 0.75px;
  left: 0.4125rem;
  width: 2.325rem;
}
.btn-toggle.btn-sm:before {
  text-align: right;
}
.btn-toggle.btn-sm:after {
  text-align: left;
  opacity: 0;
}
.btn-toggle.btn-sm.active:before {
  opacity: 0;
}
.btn-toggle.btn-sm.active:after {
  opacity: 1;
}
.btn-toggle.btn-xs:before,
.btn-toggle.btn-xs:after {
  display: none;
}
.btn-toggle:before,
.btn-toggle:after {
  color: #6b7381;
}
.btn-toggle.active {
  background-color: #29b5a8;
}
.btn-toggle.btn-lg {
  margin: 0 5rem;
  padding: 0;
  position: relative;
  border: none;
  height: 2.5rem;
  width: 5rem;
  border-radius: 2.5rem;
}
.btn-toggle.btn-lg:focus,
.btn-toggle.btn-lg.focus,
.btn-toggle.btn-lg:focus.active,
.btn-toggle.btn-lg.focus.active {
  outline: none;
}
.btn-toggle.btn-lg:before,
.btn-toggle.btn-lg:after {
  line-height: 2.5rem;
  width: 5rem;
  text-align: center;
  font-weight: 600;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 2px;
  position: absolute;
  bottom: 0;
  transition: opacity 0.25s;
}
.btn-toggle.btn-lg:before {
  content: 'Off';
  left: -5rem;
}
.btn-toggle.btn-lg:after {
  content: 'On';
  right: -5rem;
  opacity: 0.5;
}
.btn-toggle.btn-lg > .handle {
  position: absolute;
  top: 0.3125rem;
  left: 0.3125rem;
  width: 1.875rem;
  height: 1.875rem;
  border-radius: 1.875rem;
  background: #fff;
  transition: left 0.25s;
}
.btn-toggle.btn-lg.active {
  transition: background-color 0.25s;
}
.btn-toggle.btn-lg.active > .handle {
  left: 2.8125rem;
  transition: left 0.25s;
}
.btn-toggle.btn-lg.active:before {
  opacity: 0.5;
}
.btn-toggle.btn-lg.active:after {
  opacity: 1;
}
.btn-toggle.btn-lg.btn-sm:before,
.btn-toggle.btn-lg.btn-sm:after {
  line-height: 0.5rem;
  color: #fff;
  letter-spacing: 0.75px;
  left: 0.6875rem;
  width: 3.875rem;
}
.btn-toggle.btn-lg.btn-sm:before {
  text-align: right;
}
.btn-toggle.btn-lg.btn-sm:after {
  text-align: left;
  opacity: 0;
}
.btn-toggle.btn-lg.btn-sm.active:before {
  opacity: 0;
}
.btn-toggle.btn-lg.btn-sm.active:after {
  opacity: 1;
}
.btn-toggle.btn-lg.btn-xs:before,
.btn-toggle.btn-lg.btn-xs:after {
  display: none;
}
.btn-toggle.btn-sm {
  margin: 0 0.5rem;
  padding: 0;
  position: relative;
  border: none;
  height: 1.5rem;
  width: 3rem;
  border-radius: 1.5rem;
}
.btn-toggle.btn-sm:focus,
.btn-toggle.btn-sm.focus,
.btn-toggle.btn-sm:focus.active,
.btn-toggle.btn-sm.focus.active {
  outline: none;
}
.btn-toggle.btn-sm:before,
.btn-toggle.btn-sm:after {
  line-height: 1.5rem;
  width: 0.5rem;
  text-align: center;
  font-weight: 600;
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 2px;
  position: absolute;
  bottom: 0;
  transition: opacity 0.25s;
}
.btn-toggle.btn-sm:before {
  content: 'No';
  left: -0.5rem;
}
.btn-toggle.btn-sm:after {
  content: 'Yes';
  right: -0.5rem;
  opacity: 0.5;
}
.btn-toggle.btn-sm > .handle {
  position: absolute;
  top: 0.1875rem;
  left: 0.1875rem;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 1.125rem;
  background: #fff;
  transition: left 0.25s;
}
.btn-toggle.btn-sm.active {
  transition: background-color 0.25s;
}
.btn-toggle.btn-sm.active > .handle {
  left: 1.6875rem;
  transition: left 0.25s;
}
.btn-toggle.btn-sm.active:before {
  opacity: 0.5;
}
.btn-toggle.btn-sm.active:after {
  opacity: 1;
}
.btn-toggle.btn-sm.btn-sm:before,
.btn-toggle.btn-sm.btn-sm:after {
  line-height: -0.5rem;
  color: #fff;
  letter-spacing: 0.75px;
  /* left: 0.4125rem; */
  left: 0.325rem;
  width: 2.325rem;
}
.btn-toggle.btn-sm.btn-sm:before {
  text-align: right;
}
.btn-toggle.btn-sm.btn-sm:after {
  text-align: left;
  opacity: 0;
}
.btn-toggle.btn-sm.btn-sm.active:before {
  opacity: 0;
}
.btn-toggle.btn-sm.btn-sm.active:after {
  opacity: 1;
}
.btn-toggle.btn-sm.btn-xs:before,
.btn-toggle.btn-sm.btn-xs:after {
  display: none;
}
.btn-toggle.btn-xs {
  margin: 0 0;
  padding: 0;
  position: relative;
  border: none;
  height: 1rem;
  width: 2rem;
  border-radius: 1rem;
}
.btn-toggle.btn-xs:focus,
.btn-toggle.btn-xs.focus,
.btn-toggle.btn-xs:focus.active,
.btn-toggle.btn-xs.focus.active {
  outline: none;
}
.btn-toggle.btn-xs:before,
.btn-toggle.btn-xs:after {
  line-height: 1rem;
  width: 0;
  text-align: center;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 2px;
  position: absolute;
  bottom: 0;
  transition: opacity 0.25s;
}
.btn-toggle.btn-xs:before {
  content: 'Off';
  left: 0;
}
.btn-toggle.btn-xs:after {
  content: 'On';
  right: 0;
  opacity: 0.5;
}
.btn-toggle.btn-xs > .handle {
  position: absolute;
  top: 0.125rem;
  left: 0.125rem;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 0.75rem;
  background: #fff;
  transition: left 0.25s;
}
.btn-toggle.btn-xs.active {
  transition: background-color 0.25s;
}
.btn-toggle.btn-xs.active > .handle {
  left: 1.125rem;
  transition: left 0.25s;
}
.btn-toggle.btn-xs.active:before {
  opacity: 0.5;
}
.btn-toggle.btn-xs.active:after {
  opacity: 1;
}
.btn-toggle.btn-xs.btn-sm:before,
.btn-toggle.btn-xs.btn-sm:after {
  line-height: -1rem;
  color: #fff;
  letter-spacing: 0.75px;
  left: 0.275rem;
  width: 1.55rem;
}
.btn-toggle.btn-xs.btn-sm:before {
  text-align: right;
}
.btn-toggle.btn-xs.btn-sm:after {
  text-align: left;
  opacity: 0;
}
.btn-toggle.btn-xs.btn-sm.active:before {
  opacity: 0;
}
.btn-toggle.btn-xs.btn-sm.active:after {
  opacity: 1;
}
.btn-toggle.btn-xs.btn-xs:before,
.btn-toggle.btn-xs.btn-xs:after {
  display: none;
}
.btn-toggle.btn-secondary {
  color: #6b7381;
  background: #bdc1c8;
}
.btn-toggle.btn-secondary:before,
.btn-toggle.btn-secondary:after {
  color: #6b7381;
}
.btn-toggle.btn-secondary.active {
  background-color: #ff8300;
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