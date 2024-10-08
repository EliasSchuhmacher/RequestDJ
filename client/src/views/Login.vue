<template>
  <div class="row pb-3">
    <div class="col d-flex justify-content-center">
      <h1>DJ login</h1>
    </div>
  </div>
  <div class="row">
    <div class="col"></div>
    <div class="col-8 col-md-4">
      <div v-if="msg !== ''" class="alert alert-danger">
        <strong>Error! </strong>{{ msg }}
      </div>
      <form @submit.prevent="authenticate()">
        <div class="form-floating mb-3 mt-3 shadow">
          <input
            id="username"
            v-model="username"
            type="text"
            class="form-control"
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
            class="form-control"
            placeholder="password..."
            required
          />
          <label for="password">Enter password:</label>
        </div>
        <button type="submit" class="btn btn-dark mt-4 w-100" :disabled="isLoading">OK</button>
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
