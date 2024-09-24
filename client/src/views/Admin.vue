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
        <div
          v-for="songRequest in $store.state.songRequests"
          :key="songRequest.id"
          class="card my-2 py-4 shadow rounded"
        >
          <div class="px-3 d-flex justify-content-between align-items-center">
            <div v-if="songRequest.song_title" >
              <i class="fas fa-music me-3"></i><strong>{{ songRequest.song_title }}</strong>
              <span v-if="songRequest.song_artist"> by {{ songRequest.song_artist }} </span>
            </div>
            <div v-else>
              <i class="fas fa-user me-3"></i><strong>{{ songRequest.song_artist }}</strong>
            </div>
          </div>
        </div>
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
  async mounted() {
    const { commit } = this.$store;
    const resTimeslots = await fetch(`/api/timeslots`);
    const { timeslots } = await resTimeslots.json();
    
    const resSongRequests = await fetch(`/api/songrequests/${this.$store.state.username}`);
    const { songRequests } = await resSongRequests.json();

    // Update the store with the fetched timeslots
    commit("setTimeslots", timeslots);
    commit("setSongRequests", songRequests);
  },
  methods: {
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
      fetch("/api/removetime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(console.error);
    },
  },
};
</script>
