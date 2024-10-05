<!-- eslint-disable vue/prop-name-casing -->
<template>
  <div class="row">
    <div class="col"></div>
    <div class="col-sm-6">
      <div class="card shadow-lg mt-5">
        <div 
          v-if="!requestSent"
          class="card-body"
        >
          <p class="lead py-3 text-center">
            Provide song details:
          </p>
          <h1 class="text-center">{{ countDown }}</h1>
          <div class="form-floating mb-3 mt-3">
            <input
              id="song_title"
              v-model="song_title"
              type="text"
              class="form-control"
              placeholder="Enter Song Title..."
              name="song_title"
              @input="debouncedSearch"
            />
            <label for="song_title">Enter Song Title or/and Artist:</label>
            <ul v-if="suggestions.length" class="suggestions-list">
              <li
                v-for="(suggestion, index) in suggestions"
                :key="index"
                @click="selectSuggestion(suggestion)"
              >
                {{ suggestion }}
              </li>
            </ul>
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
          <button type="button" class="btn btn-primary w-100" @click="reset()">
            Request Another Song
          </button>
        </div>
      </div>
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
export default {
  name: "RequestSongView",
  components: {},
  props: {
    // eslint-disable-next-line vue/prop-name-casing
    DJ_name: {
      type: String,
      required: true
    }
  },
  data: () => ({
    song_title: "",
    //song_artist: "",
    suggestions: [], // Initialize as an empty array
    requestSent: false,
    errorMessage: "",
    msg: "",
    countDown: "",
    token: "",
    debouncedSearch: null, // Placeholder for the debounced search function
  }),
  
  created() {
    // Initialize the debounced function with a delay of 300ms
    this.debouncedSearch = this.debounce(this.searchSpotify, 300);
  },
  
  async mounted() {
    try {
      this.token = await this.fetchSpotifytoken(); // Use await to get the resolved token
      // console.log("Fetched token on mount:", this.token); // Log the token
    } catch (error) {
      console.error("Error fetching token on mount:", error);
    }
  },

  methods: {
    validateEmail() {
      if (!/[0-9]/.test(this.name) && this.name.length >= 3) {
        this.msg = "";
      } else {
        this.msg = "Name must consist of at least 3 letters";
      }
    },
  
  // we only want to send spotify request after 300 ms after typing  
  debounce(func, delay) {
      let timeout;
      return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
      };
    },

    // if they choose one of the suggestions submit
    selectSuggestion(suggestion) {
      // Set the input value to the selected suggestion
      this.song_title = suggestion;
      // Clear suggestions after selecting one
      this.suggestions = [];
    },

    // get the spotify token that is needed for api calls from backend
    async fetchSpotifytoken() {
      return await fetch(`/api/spotify/token`)
        .then(response => response.json())
        .then(data => {
          // onsole.log(data.accessToken); // Do something with the token
          return data.accessToken
        })
        .catch(error => {
          console.error('Failed to get Spotify Access Token:', error);
        });
    },
    
    //api calls to spotify's server
    async searchSpotify() {
      const query = this.song_title
      const type = "track,artist"; // Search for both tracks and artists
      //console.log("vi är inne i searchSpotify")
      try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=${type}`, {
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
          artists: track.artists.map(artist => artist.name).join(', '), // Join artist names
        }));
        // console.log("vi är på rad 173")
        // Get the top 5 tracks
        const topTracks = extractedTracks.slice(0, 5); // Limit to top 5 tracks

        // Store the track names in this.suggestions
        this.suggestions = topTracks.map(track => `${track.name} by ${track.artists}`);
      } catch (error) {
        console.error('Failed to search Spotify:', error);
        throw error; // Handle errors appropriately
      }
    },

    sendRequest() {
      if (this.song_title === "" && this.song_artist === "") {
        // Don't let users book with an invalid username.
        console.log("Both fields are empty");
        this.errorMessage = "Please fill in at least one of the fields";
        return;
      }
      // Reset the error message
      this.errorMessage = "";
      
      // Check if the user has made a request in the last 30 minutes
      const lastRequestTime = localStorage.getItem("lastRequestTime");
      const thirtyMinutes = 30 * 60 * 1000;
      const currentTime = new Date().getTime();
      if (lastRequestTime && currentTime - lastRequestTime < thirtyMinutes) {
        console.log("Please wait before making another request.");
        this.errorMessage = "You can only request a song every 30 minutes.";
        return;

  }

      // Send the booking to server via AJAX-post request
      fetch(`/api/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
         credentials: "include", // Include credentials such as cookies
        body: JSON.stringify({
          song_title: this.song_title,
          song_artist: this.song_artist,
          DJ_name: this.DJ_name,
        }),
      })
        .catch(console.error)
        .then(() => {
          this.requestSent = true;
          localStorage.setItem("lastRequestTime", currentTime);
        });
    },
    
    reset() {
      this.requestSent = false;
      this.song_title = "";
      this.song_artist = "";
      this.errorMessage = "";
      this.suggestions = [];
      this.$store.commit("setSongRequestResponse", "");
    },
  },
};
</script>
