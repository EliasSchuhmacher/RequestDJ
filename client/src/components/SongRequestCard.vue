<template>
  <div
    :class="['card my-2 shadow rounded', 
    { shimmer: status === 'coming_up', loading: status === 'playing'  }]"
  >
    <div class="px-3 py-2 d-flex justify-content-between align-items-center">
      <div v-if="songRequest.song_title" class="d-flex align-items-center w-100">
        <i class="fas fa-music me-3"></i>
        <strong class="overflow-hidden text-truncate small">{{ songRequest.song_title }}</strong>
        <span v-if="songRequest.song_artist"> by {{ songRequest.song_artist }} </span>
      </div>
      <div v-else>
        <i class="fas fa-user me-3"></i><strong>{{ songRequest.song_artist }}</strong>
      </div>
      <!-- <div class="text-muted small col-3 px-1">
        <span v-if="songRequest.status === 'coming_up'">Coming up...</span>
        <span v-else-if="songRequest.status === 'playing'">Playing</span>
      </div> -->
    </div>
    <div v-if="incoming" class="btn-group d-flex w-100" role="group">
      <button
        type="button"
        class="btn btn-light flex-fill w-100 px-0 py-2 d-flex flex-column align-items-center"
        @click="$emit('submit-comingup', songRequest.id)"
      >
        <i class="fas mt-1 fa-check"></i>
        <span class="px-0 small mt-auto">Accept</span>
      </button>
      <button
        type="button"
        class="btn btn-light flex-fill w-100 px-0 py-2 d-flex flex-column align-items-center"
        @click="$emit('submit-remove', songRequest.id)"
      >
        <i class="fas mt-1 fa-times"></i>
        <span class="px-0 small mt-auto">Reject</span>
      </button>
    </div>
    <div v-else class="btn-group d-flex w-100" role="group">
      <button
        type="button"
        class="btn btn-light flex-fill w-100 px-0 py-2 d-flex flex-column align-items-center"
        @click="$emit('set-playing', songRequest.id)"
      >
        <i :class="status === 'playing' ? 'fas mt-1 fa-check' : 'fas mt-1 fa-play'"></i>
        <span class="px-0 small mt-auto">Mark as played</span>
      </button>
    </div>
  </div>
</template>
  
<script>
  export default {
    props: {
      songRequest: {
        type: Object,
        required: true
      },
      status: {
        type: String,
        required: true
      },
      incoming: {
        type: Boolean,
        required: true
      }
    },
    emits: ['submit-comingup', 'set-playing', 'submit-remove']
  }
</script>
  
<style scoped>
.shimmer {
  animation: shimmer 1.5s infinite;
  background: linear-gradient(to right, #f6f7f8 8%, #eaeaea 18%, #f6f7f8 33%);
  background-size: 1000px 100%;
}
.loading {
  animation: loading 2.5s forwards;
  background: linear-gradient(to right, #eaeaea 50%, #f6f7f8 50%);
  background-size: 200% 100%;
}

@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}
@keyframes loading {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}
</style>