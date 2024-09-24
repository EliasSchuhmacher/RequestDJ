<template>
  <nav v-if="showNavbar" class="navbar navbar-expand-md navbar-dark">
    <div class="container-fluid">
      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarNav"
        aria-controls="navbarNav"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <div id="navbarNav" class="collapse navbar-collapse">
        <ul class="navbar-nav me-auto">
          <li v-if="$store.state.authenticated === false" class="nav-item">
            <a class="nav-link" href="#" @click="redirect('/login')">Login</a>
          </li>
          <li v-if="$store.state.authenticated === false" class="nav-item">
            <a class="nav-link" href="#" @click="redirect('/signup')">Sign up</a>
          </li>
          <li v-if="$store.state.authenticated === true" class="nav-item">
            <a class="nav-link" href="#" @click="redirect('/admin')">{{
              $store.state.username
            }}</a>
          </li>
          <li v-if="$store.state.authenticated === true" class="nav-item">
            <a class="nav-link" href="#" @click="logout()">Sign out</a>
          </li>
        </ul>
      </div>
    </div>
  </nav>
  <section class="container-fluid py-3">
    <router-view />
  </section>
</template>

<script>
// @ is an alias to /src
import "bootstrap";
import io from "socket.io-client";

export default {
  name: "App",
  components: {},
  data: () => ({
    socket: io(/* socket.io options */).connect(),
  }),
  computed: {
    showNavbar() {
      // Hide the navbar on routes that start with '/requestsong/'
      return !/^\/requestsong\/.+/.test(this.$route.path);
    },
  },
  mounted() {
    const { commit, getters } = this.$store;
    const { push } = this.$router;

    // Configure socket responses
    this.socket.on("update", (timeslot) =>
      commit("updateTimeslot", JSON.parse(timeslot))
    );
    this.socket.on("new", (timeslot) =>
      commit("newTimeslot", JSON.parse(timeslot))
    );
    this.socket.on("remove", (id) => commit("removeTimeslot", id));

    // Make first long poll request:
    this.longPoll();
    /* this.socket.on("inactivityLogout", () => {
      commit("setAuthenticated", false);
      push("/login");
    }) */

    // Check if cookie is logged in already or not
    console.log("mounted... now fetching if logged in or not");
    fetch("/api/users/me", {
      method: "GET",
    })
      .then((res) => res.json())
      .then(({ authenticated, username }) => {
        if (authenticated === true) {
          commit("setAuthenticated", true);
          commit("setUsername", username);
        } else {
          commit("setAuthenticated", false);
        }
      })
      .then(() => {
        console.log(getters.isAuthenticated);
        push(getters.isAuthenticated === true ? "/admin" : "/login");
      })
      .catch(console.error);

    // BONUS 4X send "activity" message every time the user clicks or presses a button.
    window.addEventListener("mousedown", this.notifyActivity);
    window.addEventListener("keydown", this.notifyActivity);
  },
  methods: {
    redirect(target) {
      this.$router.push(target);
    },
    logout() {
      const { commit } = this.$store;
      const { push } = this.$router;

      console.log("Logout called on client side");
      fetch("/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: this.$store.state.username }),
      })
        .then(() => {
          commit("setAuthenticated", false);
          commit("setUsername", "");
          push("/login");
        })
        .catch(console.error);
    },
    notifyActivity() {
      const { getters } = this.$store;

      // Unneccesary to send lots of activity notifications if the user isn't logged in anyway
      if (getters.isAuthenticated === true) {
        console.log("User activity detected, notifying server");
        this.socket.send("activity");
      }
    },
    longPoll() {
      const { commit } = this.$store;
      const { push } = this.$router;
      fetch("/api/sessionStatus")
        .then((res) => res.json())
        .then((res) => {
          console.log(res);
          if (res.hasValue === true) {
            if (res.message === "logout") {
              commit("setAuthenticated", false);
              push("/login");
            }
          }
        })
        .then(() => {
          // Always make new longPoll request:
          this.longPoll();
        });
    },
  },
};
</script>

<style>
@import url("bootstrap/dist/css/bootstrap.css");

html,
body {
  /* https://designs.ai/colors */

  /* background-color: #c4ffff; */
  background-image: linear-gradient(
    to right,
    rgb(242 112 156),
    rgb(255 148 114)
  );
}
</style>
