<template>
  <div class="row mt-5">
    <div class="col"></div>
    <div class="col-10 col-md-5 py-5 px-3 px-md-5 bg-secondary-custom rounded">
      <div class="row pb-3 mt-4">
        <div class="col d-flex justify-content-center">
          <h1>Sign up</h1>
        </div>
      </div>
      <div v-if="msg !== ''" class="alert alert-danger">
        <strong>Error! </strong>{{ msg }}
      </div>
      <form @submit.prevent="signup()">
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
        <div class="form-floating mb-3 mt-3 shadow">
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            class="form-control bg-primary-custom text-light border-secondary"
            placeholder="confirm password..."
            required
          />
          <label for="confirmPassword">Confirm password:</label>
        </div>

        <button type="submit" class="btn btn-dark mt-4 w-100">Sign Up</button>
        <p class="mt-3 text-center">
          Already have an account? <router-link to="/login" class="text-light">Log in</router-link>
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