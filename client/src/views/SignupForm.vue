<template>
  <div class="row pb-3 mt-4">
    <div class="col d-flex justify-content-center">
      <h1>Sign up</h1>
    </div>
  </div>
  <div class="row">
    <div class="col"></div>
    <div class="col-8 col-md-4">
      <div v-if="msg !== ''" class="alert alert-danger">
        <strong>Error! </strong>{{ msg }}
      </div>
      <form @submit.prevent="signup()">
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
        <div class="form-floating mb-3 mt-3 shadow">
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            class="form-control"
            placeholder="confirm password..."
            required
          />
          <label for="confirmPassword">Confirm password:</label>
        </div>

        <button type="submit" class="btn btn-dark mt-4 w-100">Sign Up</button>
        <p class="mt-3 text-center">
          Already have an account? <router-link to="/login" class="text-dark">Log in</router-link>
        </p>
      </form>
    </div>
    <div class="col"></div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      username: '',
      password: '',
      confirmPassword: '',
      msg: ''
    };
  },
  methods: {
    signup() {
      const { commit } = this.$store;
      const { push } = this.$router;

      if (this.password !== this.confirmPassword) {
        this.msg = "Passwords do not match!";
        return;
      }

      // Perform signup logic here
      fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.username,
          password: this.password
        })
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => {
            this.msg = err.message || 'An error occurred';
            throw new Error(this.msg);
          });
        }
        return response.json();
      })
      .then(({ authenticated }) => {
        if (authenticated === true) {
          commit("setAuthenticated", authenticated);
          commit("setUsername", this.username);
          push("/admin");
        }
      })
      .catch(error => {
        // Handle signup error
        this.msg = error.message;
      });
    }
  }
};
</script>