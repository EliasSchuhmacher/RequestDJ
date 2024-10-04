<template>
  <div class="row">
  <div class="col-sm-6 px-5">
    <h3> Incoming Requests </h3>
    <p 
      v-if="incomingSongRequests.length === 0"
      class="lead fst-italic mt-3"
    >
      Waiting for requests, scan the QR code to send a song request...
    </p>
    <transition-group name="slam" tag="div">
      <SongRequestCard
        v-for="songRequest in incomingSongRequests"
        :key="songRequest.id"
        :song-request="songRequest"
        @set-playing="setPlaying"
        @submit-remove="submitRemove"
        @submit-comingup="submitComingUp"
      />
    </transition-group>
  </div>
  <div class="col-sm-6 px-5">
    <h3> Accepted Requests </h3>
    <transition-group name="slam" tag="div">
      <SongRequestCard
        v-for="songRequest in acceptedSongRequests"
        :key="songRequest.id"
        :song-request="songRequest"
        @set-playing="setPlaying"
        @submit-remove="submitRemove"
        @submit-comingup="submitComingUp"
      />
    </transition-group>
  </div>
</div>
</template>

<script>
import SongRequestCard from "../components/SongRequestCard.vue";

export default {
  name: "AdminView",
  components: {
    SongRequestCard,
  },
  data: () => ({
    newtime: "10:00",
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
      return this.$store.state.songRequests.filter(request => request.status === 'coming_up');
    },
    incomingSongRequests() {
      return this.$store.state.songRequests.filter(request => request.status !== 'coming_up');
    },
  },
  async mounted() {
    const { commit } = this.$store;
    const res = await fetch(`/api/songs/${this.$store.state.username}`);
    const { songRequests } = await res.json();

    // Update the store with the fetched songRequests
    commit("setSongRequests", songRequests);
    commit("sortSongRequests");
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
      this.updateStatus(id, 'coming_up');
      this.$store.commit("moveSongRequestToTop", id);

      fetch("/api/comingup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(console.error);
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