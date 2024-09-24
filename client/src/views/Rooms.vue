<template>
  <div class="row">
    <div class="col"></div>
    <div class="col list-group">
      <button
        v-for="room in rooms"
        :key="room.name"
        type="button"
        class="list-group-item list-group-item-action my-2 py-2"
        @click="redirect(room.name)"
      >
        {{ room.name }}
      </button>
    </div>
    <div class="col"></div>
  </div>
</template>

<script>
export default {
  name: "RoomsView",
  components: {},
  data: () => ({
    rooms: [
      { name: "c++" },
      { name: "java" },
      { name: "js" },
      { name: "python" },
    ],
  }),
  methods: {
    redirect(name) {
      this.$router.push(`/rooms/${name}`);
    },
  },
};
</script>
