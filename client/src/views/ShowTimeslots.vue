<template>
  <div class="row">
    <div class="col"></div>
    <div class="col-sm-6">
      <h3>All timeslots:</h3>
      <div class="list-group">
        <button
          v-for="timeslot in $store.state.timeslots"
          :key="timeslot.time"
          type="button"
          :class="[
            'list-group-item',
            'shadow',
            'list-group-item-action',
            'my-2',
            'py-2',
            { disabled: timeslot.status === 'Reserved' },
          ]"
          :disabled="timeslot.status !== 'Available'"
          @click="confirmBooking(timeslot)"
        >
          <span
            ><strong>{{ timeslot.time }}</strong> @{{
              timeslot.assistantName
            }}</span
          >
          <span v-if="timeslot.status === 'Reserved'" class="float-end">
            Reserved
            <span class="spinner-border spinner-border-sm"></span>
          </span>
          <span v-if="timeslot.status === 'Booked'" class="float-end">
            <i>booked by: </i><strong>{{ timeslot.bookedBy }}</strong>
          </span>
        </button>
      </div>
    </div>
    <div class="col"></div>
  </div>
</template>

<script>
export default {
  name: "ShowTimeslotsView",
  components: {},
  data: () => ({}),
  async mounted() {
    const { commit } = this.$store;
    const res = await fetch(`/api/timeslots`);
    const { timeslots } = await res.json();

    // Update the store with the fetched timeslots
    commit("setTimeslots", timeslots);
  },
  methods: {
    confirmBooking(timeslot) {
      const { commit } = this.$store;
      commit("setSelectedBookingTimeslot", timeslot);

      // Send reservation to server via AJAX-post request:
      fetch(`/api/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeslotId: this.$store.state.selectedBookingTimeslot.id,
        }),
      }).catch(console.error);

      this.$router.push(`/booking`);
    },
  },
};
</script>
