<template>
  <div class="container-fluid dvh-100 px-0 d-flex flex-column text-primary-custom">
    <nav v-if="showNavbar" class="navbar navbar-expand-sm navbar-dark">
      <div class="container-fluid px-3">
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
            <li class="navbar-item">
              <a class="nav-link fw-bold" href="/">RequestDJ</a>
            </li>
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
          <ul class="navbar-nav ms-auto">
            <li v-if="$store.state.authenticated === true" class="nav-item">
              <a class="nav-link" href="#" @click="generateQRCode()">Generate QR Code</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
    <section class="flex-grow-1 overflow-hidden bg-primary-custom px-3">
      <router-view />
    </section>
  </div>
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
    this.socket.on("new", (songRequest) =>
      commit("newSongRequest", JSON.parse(songRequest))
    );
    this.socket.on("played", () =>
      commit("setSongRequestResponse", "played")
    );
    this.socket.on("coming_up", () =>
      commit("setSongRequestResponse", "coming_up")
    );
    this.socket.on("rejected", () =>
      commit("setSongRequestResponse", "rejected")
    );

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
        const currentPath = window.location.pathname;
        console.log("Current path: ", currentPath);
        if (getters.isAuthenticated === true  && !currentPath.includes("/requestsong/")) {
          push("/admin");
        }
        // push(getters.isAuthenticated === true ? "/admin" : "/login");
      })
      .catch(console.error);

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
    generateQRCode() {
      // ENTER YOUR WIFI LOCAL IP HERE (temporary solution):
      // const localip = "";
      // const localip = "192.168.1.121";
      const qrcodeURL = "https://requestdj.onrender.com/requestsong/";

      // if (!localip) {
      //   // eslint-disable-next-line no-alert
      //   alert("I App.vue, ändra variabeln 'localip' till din lokala IP-adress för att detta ska fungera (temporär lösning)");
      //   return;
      // }
      const data = encodeURIComponent(`${qrcodeURL}${this.$store.state.username}`);  
      const size = 300;
      const windowSize = 350;
      // const config = encodeURIComponent(JSON.stringify({}));
      // const file = "png";
      // const download = false;

      const qrCodeUrl = `https://quickchart.io/qr?text=${data}&caption=Scan%20to%20Request%20Song&captionFontFamily=sanserif&captionFontSize=30&size=${size}`;
      // https://quickchart.io/qr?text=https://requestdj.onrender.com/requestsong/&caption=Scan%20to%20Request%20Music&captionFontFamily=sanserif&captionFontSize=20$size=300
      // const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`;
      window.open(qrCodeUrl, "_blank", `width=${windowSize},height=${windowSize}`);
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

html, body {
  /* https://designs.ai/colors */
  font-family: "Helvetica Neue", sans-serif;
  background-color: #212121
  /* background-image: linear-gradient(
    to right,
    rgb(242 112 156),
    rgb(255 148 114)
  ); */
}

/* Custom class for dynamic viewport height */
.dvh-100 {
  height: 100dvh;
}

/* Custom color classes */
.bg-primary-custom {
  background-color: #212121 !important;
}

.bg-secondary-custom {
  background-color: #121212 !important;
}

.bg-tertiary-custom {
  background-color: #535353 !important;
}

.bg-green-custom {
  background-color: #1ED760 !important;
}

.text-primary-custom {
  color: #FFFFFF !important;
}

.text-secondary-custom {
  color: #1ED760 !important;
}

/* Autofill styles */
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus,
input:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0 30px #212121 inset !important; /* Match the background color */
  -webkit-text-fill-color: #f8f9fa !important; /* Match the text color */
}
</style>
