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
      <div class="card shadow">
        <div class="card-header">Add new timeslot</div>
        <div class="card-body">
          <form @submit.prevent="submitTime()">
            <label class="form-label" for="timepicker"
              >Select a time: &nbsp;&nbsp;</label
            >
            <input
              id="timepicker"
              v-model="newtime"
              type="time"
              name="timeslot"
            />
            <button type="submit" class="float-end btn btn-primary">
              Submit
            </button>
          </form>
        </div>
      </div>
      <div class="list-group">
        <button
          v-for="songRequest in $store.getters.getSongRequests"
          :key="songRequest.request_id"
          type="button"
          class="list-group-item list-group-item-action my-2 py-2 shadow"
        >
          <strong>Song:</strong> {{ songRequest.song_title }}
          by {{ songRequest.artist_name }}
          <button
            type="button"
            class="btn-close float-end"
            aria-label="Close"
            @click="submitRemove(songRequest.request_id)"
          ></button>
        </button>
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
    
    const resSongRequests = await fetch(`/api/songRequests/${this.$store.state.username}`);
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
