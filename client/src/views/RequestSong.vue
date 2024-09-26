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
            />
            <label for="song_title">Enter Song Title:</label>
          </div>
          <div class="form-floating mb-3 mt-3">
            <input
            id="song_artist"
            v-model="song_artist"
            type="text"
            class="form-control"
            placeholder="Enter Song Artist..."
            name="song_artist"
            />
            <label for="song_artist">Enter Song Artist:</label>
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
    song_artist: "",
    requestSent: false,
    errorMessage: "",
  }),
  methods: {
    validateEmail() {
      if (!/[0-9]/.test(this.name) && this.name.length >= 3) {
        this.msg = "";
      } else {
        this.msg = "Name must consist of at least 3 letters";
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

      // Send the booking to server via AJAX-post request
      fetch(`/api/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          song_title: this.song_title,
          song_artist: this.song_artist,
          DJ_name: this.DJ_name,
        }),
      })
        .catch(console.error)
        .then(() => {
          this.requestSent = true;
          this.song_title = "";
          this.song_artist = "";
        });
    },
    reset() {
      this.requestSent = false;
    },
  },
};
</script>
