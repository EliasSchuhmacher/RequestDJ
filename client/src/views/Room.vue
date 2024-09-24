<template>
  <div class="row">
    <div class="col-3"></div>
    <ul class="col-6 list-group">
      <li
        v-for="(msg, i) in messages"
        :key="i"
        type="button"
        class="list-group-item py-1"
      >
        {{ msg }}
      </li>
      <form @submit.prevent="send()">
        <label for="message"></label>
        <input
          id="message"
          v-model="message"
          type="text"
          class="form-control form-control-sm"
          placeholder="message..."
          required
        />
        <button type="submit" class="btn btn-dark mt-4 float-end">SEND</button>
      </form>
    </ul>
    <div class="col-3"></div>
  </div>
</template>

<script>
export default {
  name: "RoomView",
  components: {},
  data() {
    return {
      messages: [],
      message: "",
    };
  },
  methods: {
    send() {
      this.messages = [...this.messages, this.message];
      this.message = "";
    },
  },
};
</script>
