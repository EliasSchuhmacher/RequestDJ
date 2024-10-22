<template>
  <div class="row mt-5">
    <div class="col"></div>
    <div class="col-10 col-md-5 py-5 px-3 px-md-5 shadow bg-secondary-custom rounded">
      <div class="row pb-3 mt-4">
        <div class="col d-flex justify-content-center">
          <h1>DJ Login</h1>
        </div>
      </div>
      <div v-if="msg !== ''" class="alert alert-danger">
        <strong>Error! </strong>{{ msg }}
      </div>
      <form @submit.prevent="authenticate()">
        <div class="form-floating mb-3 mt-3 shadow">
          <input
            id="username"
            v-model="username"
            type="text"
            class="form-control bg-primary-custom text-light border-secondary"
            placeholder="username..."
            required
          />
          <label for="username">Enter your username:</label>
        </div>
        <div class="form-floating mb-3 mt-3 shadow">
          <input
            id="password"
            v-model="password"
            type="password"
            class="form-control bg-primary-custom text-light border-secondary"
            placeholder="password..."
            required
          />
          <label for="password">Enter password:</label>
        </div>
        <button type="submit" class="btn btn-dark mt-4 w-100 bg-green-custom" :disabled="isLoading">OK</button>
        <p class="mt-3 text-center">
          No account yet? <router-link to="/signup" class="text-light">Sign up</router-link>
        </p>
      </form>
    </div>
    <div class="col"></div>
  </div>
</template>

<script>
export default {
  name: "LoginView",
  components: {},
  data: () => ({
    username: "",
    password: "",
    msg: "",
    isLoading: false,
  }),
  methods: {
    authenticate() {
      const { commit } = this.$store;
      const { push } = this.$router;

      // Set loading state to true
      this.isLoading = true;

      // Make an ajax post request to server with login details as request body
      fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
      })
        .then((res) => res.json())
        .then(({ authenticated }) => {
          commit("setAuthenticated", authenticated);
          if (authenticated === true) {
            commit("setUsername", this.username);
            push("/admin");
          } else {
            this.msg = "Invalid Username/Password";
          }
        })
        .catch(console.error)
        .finally(() => {
          // Set loading state to false
          this.isLoading = false;
        });
    },
  },
};
</script>
