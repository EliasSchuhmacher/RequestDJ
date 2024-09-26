<template>
  <div class="row">
    <div class="col"></div>
    <div class="col-sm-6">
      <h2>Signed in as {{ $store.state.username }}</h2>
    </div>
    <div class="col"></div>
  </div>
  <div class="row">
    <div class="col"></div>
    <div class="col-sm-6">
      <p 
        v-if="$store.state.songRequests.length === 0"
        class="lead fst-italic mt-3">Waiting for requests...</p>
      <transition-group name="slam" tag="div">
        <div
          v-for="songRequest in sortedSongRequests"
          :key="songRequest.id"
          :class="['card my-2 pt-3 shadow rounded', { shimmer: songRequest.status === 'coming_up' }]"
        >
          <div class="px-3 d-flex justify-content-between align-items-center">
            <div v-if="songRequest.song_title" >
              <i class="fas fa-music me-3"></i><strong>{{ songRequest.song_title }}</strong>
              <span v-if="songRequest.song_artist"> by {{ songRequest.song_artist }} </span>
            </div>
            <div v-else>
              <i class="fas fa-user me-3"></i><strong>{{ songRequest.song_artist }}</strong>
            </div>
            <div class="text-muted small mb-auto">
              <span v-if="songRequest.status === 'coming_up'">Coming up...</span>
              <span v-else-if="songRequest.status === 'playing'">Playing</span>
            </div>
          </div>
          <div class="btn-group d-flex w-100 mt-3" role="group">
            <button
              type="button"
              class="btn btn-light flex-fill w-100 px-0 py-2 d-flex flex-column align-items-center"
              @click="updateStatus(songRequest.id, 'coming_up')"
            >
              <i class="fas mt-1 fa-hourglass-start"></i>
              <span class="px-0 small mt-auto">Coming up</span>
            </button>
            <button
              type="button"
              class="btn btn-light flex-fill w-100 px-0 py-2 d-flex flex-column align-items-center"
              @click="submitRemove(songRequest.id)"
            >
              <i class="fas mt-1 fa-play"></i>
              <span class="px-0 small mt-auto">Playing</span>
            </button>
            <button
              type="button"
              class="btn btn-light flex-fill w-100 px-0 py-2 d-flex flex-column align-items-center"
              @click="submitRemove(songRequest.id)"
            >
              <i class="fas mt-1 fa-times"></i>
              <span class="px-0 small mt-auto">Reject</span>
            </button>
          </div>
        </div>
      </transition-group>
      
    </div>
    <div class="col"></div>
  </div>
</template>

<script>
export default {
  name: "AdminView",
  components: {},
  data: () => ({
    newtime: "10:00",
  }),
  computed: {
    sortedSongRequests() {
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
  },
  async mounted() {
    const { commit } = this.$store;
    const res = await fetch(`/api/songs/${this.$store.state.username}`);
    const { songRequests } = await res.json();

    // Update the store with the fetched timeslots
    commit("setSongRequests", songRequests);
  },
  methods: {
    redirect(name) {
      this.$router.push(`/rooms/${name}`);
    },
    submitTime() {
      fetch("/api/newtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          time: this.newtime,
          username: this.$store.state.username,
        }),
      }).catch(console.error);
    },
    // FIX ME!
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
  },
};
</script>

<style scoped>
.slam-enter-active {
  animation: slam-in 0.5s ease-out;
}
.shimmer {
  animation: shimmer 1.5s infinite;
  background: linear-gradient(to right, #f6f7f8 8%, #eaeaea 18%, #f6f7f8 33%);
  background-size: 1000px 100%;
}

@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
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