<!-- eslint-disable vue/prop-name-casing -->
<template>
  <div class="row h-100">
    <div class="col"></div>
    <div class="col-sm-6 h-100">
      <div class="card shadow-lg mt-5 bg-secondary-custom text-light">
        <div 
          v-if="!requestSent"
          class="card-body"
        >
          <p class="lead pt-3 text-center">
            Provide song details:
          </p>
          <p class="text-center small">
            The DJ will have the choice to play or reject your song.
          </p>
          <div class="form-floating mb-3 mt-3">
            <input
              id="song_title"
              v-model="song_title"
              type="text"
              class="form-control bg-primary-custom text-light border-0"
              placeholder="Enter Song Title..."
              name="song_title"
              @input="debouncedSearch"
            />
            <label for="song_title">Enter Song Title or/and Artist:</label>
            <ul v-if="suggestions.length" class="suggestions-list pb-2 rounded-bottom bg-primary-custom">
              <li
                v-for="(suggestion, index) in suggestions"
                :key="index"
                tabindex="0"
                @click="selectSuggestion(suggestion)"
                @keydown.enter="selectSuggestion(suggestion)"
              >
                {{ suggestion.name + " by " + suggestion.artists.map(artist => artist.name).join(', ') }}
              </li>
            </ul>
          </div>
          <div class="form-floating mb-3 mt-3">
            <input
              id="requester_name"
              v-model="requester_name"
              type="text"
              class="form-control bg-primary-custom text-light border-0"
              placeholder="Enter Your Name (Optional)..."
              name="requester_name"
            />
            <label for="requester_name">Enter Your Name (Optional):</label>
          </div>
          <div v-if="errorMessage" class="alert alert-danger">
            {{ errorMessage }}
          </div>
          <button type="button" class="btn btn-primary w-100" @click="sendRequest()">
            Send Request
          </button>
        </div>
        <div 
          v-else
          class="card-body"
        >
          <p class="h4 py-5 text-center">
            <i class="fas fa-check"></i>
            Your request has been sent.
          </p>
          <p v-if="$store.state.songRequestResponse === 'played'" class="text-center text-lead">
            Horay! Your song has been played!
          </p>
          <p v-else-if="$store.state.songRequestResponse === 'coming_up'" class="text-center text-lead">
            Request Accepted! Your song will be played soon!
          </p>
          <p v-else-if="$store.state.songRequestResponse === 'rejected'" class="text-center text-lead">
            Sorry, your song request was rejected. Feel free to request another song.
          </p>
          <p v-else class="text-center text-lead">
            Awaiting DJ response...
          </p>
          <button 
            type="button"
            class="btn btn-primary w-100" 
            :disabled="requestAnotherSongDisabled"
            @click="reset()"
          >
            <span>Request Another Song </span>
            <span v-if="requestAnotherSongDisabled">- {{ formattedCountdown }} </span>
          </button>
        </div>
      </div>
      <div class="row h-100">
        <div class="col overflow-auto h-100">
          <span v-if="currentlyPlaying" class="d-block mt-1 text-muted small">Currently Playing:</span>
          <SongRequestCard
          v-if="currentlyPlaying"
          :key="currentlyPlaying.id"
          :song-request="currentlyPlaying"
          :status="'coming_up'"
          :incoming="false"
          />
          <span v-if="spotifyQueue.length > 0" class="d-block mt-2 text-muted small">Coming Up:</span>
          <SongRequestCard
          v-for="song in spotifyQueue"
          :key="song.id"
          :song-request="song"
          :status="'queued'"
          :incoming="false"
          />
        </div>
      </div>
      <p v-if="requestSent" class="text-center mt-3">
        <a href="https://forms.gle/guNj45pjAkyZN2Ju5" class="text-light">Lämna gärna feedback!</a>
      </p>
    </div>
    <div class="col"></div>
  </div>
  <div class="row">
    <div class="col"></div>
    <div class="col d-flex justify-content-center">
      <p>{{ msg }}</p>
    </div>
    <div class="col"></div>
  </div>
</template>

<script>
import SongRequestCard from "../components/SongRequestCard.vue";

export default {
  name: "RequestSongView",
  components: {
    SongRequestCard,
  },
  props: {
    // eslint-disable-next-line vue/prop-name-casing
    DJ_name: {
      type: String,
      required: true
    }
  },
  data: () => ({
    song_title: "",
    song_genre: "",
    song_spotify_id: "",
    requester_name: "",
    // song_artist: "",
    suggestions: [], // Initialize as an empty array
    spotifyQueue: [],
    currentlyPlaying: {},
    requestSent: false,
    sentSongRequestId: "",
    errorMessage: "",
    msg: "",
    countdown: 0,
    countdownInterval: null,
    requestAnotherSongDisabled: false,
    // timeoutLength: 3 * 60 * 1000,
    timeoutLength: 2 * 60 * 1000,
    token: "",
    debouncedSearch: null, // Placeholder for the debounced search function
  }),
  computed: {
    formattedCountdown() {
      const minutes = Math.floor(this.countdown / 60000);
      const seconds = Math.floor((this.countdown % 60000) / 1000);
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    },
    songRequestResponse() {
      return this.$store.state.songRequestResponse;
    }
  },
  watch: {
    songRequestResponse(newStatus) {
      if (newStatus === 'coming_up') {
        // fetch the updated queue after a short delay
        setTimeout(() => {
          this.fetchSpotifyQueue();
        }, 500);
      }
    }
  },
  created() {
    console.log("Created RequestSongView");
    // Initialize the debounced function with a delay of 300ms
    this.debouncedSearch = this.debounce(this.searchSpotify, 300);

    // Check if the user has made a request recently, and update the countdown timer
    this.updateTimer();

    // Check if the user has already made a request
    const sentSongRequestId = localStorage.getItem("sentSongRequestId");
    if (sentSongRequestId) {
      this.sentSongRequestId = sentSongRequestId;
      this.fetchSongRequestStatus(this.sentSongRequestId); // Fetch the status of the previous request
    }
  },
  
  async mounted() {
    console.log("Mounted RequestSongView");
    try {
      this.token = await this.fetchSpotifytoken(); // Use await to get the resolved token
      // console.log("Fetched token on mount:", this.token); // Log the token
    } catch (error) {
      console.error("Error fetching token on mount:", error);
    }
    this.fetchSpotifyQueue();

    // Add event listener for window focus
    window.addEventListener("focus", this.handleWindowFocus);
  },


  beforeUnmount() {
    // Remove event listener to avoid memory leaks
    window.removeEventListener("focus", this.handleWindowFocus);
  },


  methods: {
  
    // we only want to send spotify request after 300 ms after typing  
    debounce(func, delay) {
      let timeout;
      return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
      };
    },

    // Handle the window focus event, updating the song request status and timer
    handleWindowFocus() {
      console.log("Window focused");
      if (this.requestSent && this.sentSongRequestId) {
        this.updateTimer(); // Call updateTimer
        console.log("window focused, fetching song request status");
        this.fetchSongRequestStatus(this.sentSongRequestId); // Call fetchSongRequestStatus with the song request ID
      }
    },

    // Check if the user has already made a request and update the count
    updateTimer() {
      // This is triggered when the page is refreshed
      const lastRequestTime = localStorage.getItem("lastRequestTime");
      if (lastRequestTime) {
        const currentTime = new Date().getTime();
        const timeElapsed = currentTime - lastRequestTime;
        if (timeElapsed < this.timeoutLength) {
          this.requestSent = true;
          this.requestAnotherSongDisabled = true;
          this.countdown = this.timeoutLength - timeElapsed;
          // Set requestAnotherSongDisabled to false after the remaining time
          // Clear any existing countdown interval
          if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
          }
          // And also setup the countdown timer
          this.countdownInterval= setInterval(() => {
            if (this.countdown > 1000) {
              this.countdown -= 1000;
            } else {
              this.requestAnotherSongDisabled = false;
              clearInterval(this.countdownInterval);
            }
          }, 1000);
        }
      }
    },

    // if they choose one of the suggestions submit
    selectSuggestion(suggestion) {
      // Set the input value to the selected suggestion
      this.song_title = `${suggestion.name} by ${suggestion.artists.map(artist => artist.name).join(', ')}`;
      this.song_spotify_id = suggestion.spotify_id;

      // Fetch the genre of the first artist of the selected song
      // Potential problem: the user might send the request before the genre is finished fetching
      const firstArtistDetailsLink = suggestion.artists[0].href;
      fetch(firstArtistDetailsLink, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`, // Use your Spotify access token
          'Content-Type': 'application/json',
        },
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        // Extract the genres of the artist, capitalize the first letter, and join them with a comma
        this.song_genre = data.genres.map(genre => genre.charAt(0).toUpperCase() + genre.slice(1)).join(', ');
      })

      // Clear suggestions after selecting one
      this.suggestions = [];
    },

    // get the spotify token that is needed for api calls from backend
    async fetchSpotifytoken() {
      return fetch(`/api/spotify/token`)
        .then(response => response.json())
        .then(data => data.accessToken)
        .catch(error => {
          console.error('Failed to get Spotify Access Token:', error);
        });
    },
    
    // api calls to spotify's server
    async searchSpotify() {
      const query = this.song_title
      // const type = "track,artist"; // Search for both tracks and artists
      const type = "track"; // Search for only tracks
      const limit = 5; // Limit to 5 results

      // console.log("vi är inne i searchSpotify")
      try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.token}`, // Use your Spotify access token
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();
        
        // Extracting track information
        const tracks = data.tracks.items; // Get the array of track items

        const extractedTracks = tracks.map(track => ({
          name: track.name, // Track name
          // artists: track.artists.map(artist => artist.name).join(', '), // Join artist names
          artists: track.artists,
          spotify_id: track.id, // Spotify ID
        }));
        // console.log("vi är på rad 173")
        // Get the top 5 tracks
        const topTracks = extractedTracks.slice(0, 5); // Limit to top 5 tracks

        // Store the track names in this.suggestions
        // this.suggestions = topTracks.map(track => `${track.name} by ${track.artists}`);
        this.suggestions = topTracks;
      } catch (error) {
        console.error('Failed to search Spotify:', error);
        throw error; // Handle errors appropriately
      }
    },

    fetchSpotifyQueue() {
      fetch(`/api/spotifyqueue/${this.DJ_name}`, {
        method: "GET",
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Error fetching song queue, owner not logged in`);
          }
          return res.json();
        })
        .then((data) => {
          console.log("Spotify Queue: ", data);
          // Commit to store
          const queue = data.spotifyQueue.queue?.map((song) => ({
            song_title: song.name,
            song_artist: song.artists.map((artist) => artist.name).join(", "),
            song_spotify_id: song.id,
          }));
          this.spotifyQueue = queue;
          const { name, id, artists } = data.spotifyQueue.currently_playing;
          this.currentlyPlaying = {
            song_title: name,
            song_artist: artists.map((artist) => artist.name).join(", "),
            song_spotify_id: id,
          };
        })
        .catch((err) => {
          console.error("Failed to fetch Spotify queue:", err);
          // this.errorMessage = err.message || "An error occurred";
        });
    },

    sendRequest() {
      // Check that a title is supplied.
      if (this.song_title === "" && this.song_artist === "") {
        console.log("Both fields are empty");
        this.errorMessage = "Please fill in at least one of the fields";
        return;
      }

      // Reset the error message
      this.errorMessage = "";
    
      // Check if the user has made a request in the last 30 minutes
      const lastRequestTime = localStorage.getItem("lastRequestTime");
      const currentTime = new Date().getTime();
      if (lastRequestTime && currentTime - lastRequestTime < this.timeoutLength) {
        console.log("Please wait before making another request.");
        this.errorMessage = "Please wait before making another request.";
        return;
      }

      // Disable the request button and start the countdown
      this.requestAnotherSongDisabled = true;
      this.countdown = this.timeoutLength;
      this.countdownInterval = setInterval(() => {
        if (this.countdown > 0) {
          this.countdown -= 1000;
        } else {
          this.requestAnotherSongDisabled = false;
          clearInterval(this.countdownInterval);
        }
      }, 1000);

      this.requestSent = true;
      this.$store.commit("setSongRequestResponse", "");

      // Send the booking to server via AJAX-post request
      fetch(`/api/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
         credentials: "include", // Include credentials such as cookies
        body: JSON.stringify({
          song_title: this.song_title,
          song_artist: this.song_artist,
          song_spotify_id: this.song_spotify_id,
          DJ_name: this.DJ_name,
          requester_name: this.requester_name,
          song_genre: this.song_genre,
        }),
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(error => {
            throw new Error(error.message || "An error occurred");
          });
        }
        return response.json();
      })
      .then((response) => {
        this.sentSongRequestId = response.id; // Save the returned song ID
        localStorage.setItem("lastRequestTime", currentTime);
        localStorage.setItem("sentSongRequestId", this.sentSongRequestId); // Save the song request ID
      })
      .catch(err => {
        this.requestSent = false;
        this.errorMessage = err.message;
      });
    },

    // Method to fetch the current status of the song request, called on window focus
    fetchSongRequestStatus(songRequestId) {
      console.log("Fetching song request status for ID:", songRequestId);
      fetch(`/api/songrequests/${songRequestId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include credentials such as cookies
      })
        .then((response) => {
          if (!response.ok) {
            if (response.status === 404) {
              throw new Error("Song request not found");
            }
            throw new Error("Failed to fetch song request status");
          }
          return response.json();
        })
        .then((data) => {
          this.$store.commit("setSongRequestResponse", data.status);
        })
        .catch((err) => {
          console.error("Error fetching song request status:", err);
          this.$store.commit("setSongRequestResponse", "rejected"); // Optionally set an error state
        });
    },

    
    reset() {
      this.requestSent = false;
      this.song_title = "";
      this.song_artist = "";
      this.song_genre = "";
      this.song_spotify_id = "";
      this.errorMessage = "";
      this.suggestions = [];
      this.$store.commit("setSongRequestResponse", "");
      this.fetchSpotifyQueue();
    },
  },
};
</script>
