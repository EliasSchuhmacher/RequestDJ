<template>
  <div class="row">
    <div class="col"></div>
    <div class="col-sm-6">
      <div class="card shadow-lg">
        <div class="card-header">
          <strong>CONFIRM BOOKING</strong>
        </div>
        <div class="card-body">
          <p class="display-6 text-center">
            <strong>{{ $store.state.selectedBookingTimeslot.time }}</strong>
            - {{ $store.state.selectedBookingTimeslot.assistantName }}
          </p>
          <h1 class="text-center">{{ countDown }}</h1>
          <div class="form-floating mb-3 mt-3">
            <input
              id="name"
              v-model="name"
              type="text"
              class="form-control"
              placeholder="Enter your name..."
              name="name"
              @input="validateEmail()"
            />
            <label for="name">Enter your name:</label>
          </div>
          <button type="button" class="btn btn-success" @click="sendBooking()">
            Accept
          </button>
          <button
            type="button"
            class="btn btn-secondary float-end"
            @click="reject()"
          >
            Reject
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
  name: "BookingView",
  components: {},
  data: () => ({
    msg: " ",
    name: "",
    countDown: 15,
    timeoutFunction: "",
  }),
  created() {
    this.countDownTimer();
  },
  methods: {
    validateEmail() {
      if (!/[0-9]/.test(this.name) && this.name.length >= 3) {
        this.msg = "";
      } else {
        this.msg = "Name must consist of at least 3 letters";
      }
    },
    countDownTimer() {
      if (this.countDown > 0) {
        this.timeoutFunction = setTimeout(() => {
          this.countDown -= 1;
          this.countDownTimer();
        }, 1000);
      } else {
        this.reject();
      }
    },
    sendBooking() {
      if (this.msg !== "") {
        // Don't let users book with an invalid username.
        return;
      }

      // Send the booking to server via AJAX-post request
      fetch(`/api/timeslots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: this.name,
          timeslotId: this.$store.state.selectedBookingTimeslot.id,
        }),
      })
        .catch(console.error)
        .then(() => {
          this.$router.push("/timeslots");
        });

      // cancel timer
      clearTimeout(this.timeoutFunction);
    },
    reject() {
      // cancel timer
      clearTimeout(this.timeoutFunction);

      // Unreserve using AJAX-post request
      fetch(`/api/unreserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeslotId: this.$store.state.selectedBookingTimeslot.id,
        }),
      })
        .then(() => {
          this.$router.push("/timeslots");
        })
        .catch(console.error);
    },
  },
};
</script>
