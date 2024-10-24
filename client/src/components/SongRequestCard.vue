<!-- eslint-disable camelcase -->
<template>
  <div
    :class="['card my-2 shadow rounded bg-tertiary-custom', 
    { shimmer: status === 'coming_up', loading: status === 'playing'  }]"
  >
    <div class="px-3 mt-2 d-flex justify-content-between align-items-center">
      <div v-if="songRequest.song_title" class="d-flex align-items-center w-100">
        <i class="fas text-dark fa-music me-3"></i>
        <span
          v-if="songRequest.song_spotify_id"
          class="overflow-hidden small"
          :class="{ clickable: songRequest.song_spotify_id }"
          data-bs-toggle="tooltip"
          title="Click to open in Spotify"
          @click="openSpotifyLink(songRequest.song_spotify_id)" 
          @keydown.enter="openSpotifyLink(songRequest.song_spotify_id)"
        >
          <strong>{{ songRequest.song_title }}</strong>
        </span>
        <span v-else class="overflow-hidden small">
          <strong>{{ songRequest.song_title }}</strong>
        </span>
        <span v-if="songRequest.song_artist"> by {{ songRequest.song_artist }} </span>
      </div>
      <div v-else>
        <i class="fas text-dark fa-user me-3"></i><strong>{{ songRequest.song_artist }}</strong>
      </div>
    </div>
    <div v-if="songRequest.song_genre" class="px-3 mt-1 d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center w-100">
        <i class="fas text-dark fa-compact-disc me-3 icon-size"></i>
        <span class="overflow-hidden text-nowrap small"><strong>Genres:</strong> <i>{{ songRequest.song_genre }}</i></span>
      </div>
    </div>
    <div v-if="songRequest.requester_name" class="px-3 mt-1 d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center w-100">
        <i class="fas text-dark fa-user-alt me-3 icon-size"></i>
        <span class="overflow-hidden text-nowrap small"><strong>Requested by:</strong> {{ songRequest.requester_name }}</span>
      </div>
    </div>
    <div v-if="incoming" class="btn-group d-flex w-100 mt-2 border-top border-secondary" role="group">
      <button
        type="button"
        class="btn text-secondary-custom flex-fill w-100 px-0 py-2 d-flex flex-column align-items-center"
        @click="$emit('submit-comingup', songRequest.id)"
      >
        <i class="fas mt-1 fa-check"></i>
        <span class="px-0 small mt-auto">Accept</span>
      </button>
      <button
        type="button"
        class="btn text-primary-custom flex-fill w-100 px-0 py-2 d-flex flex-column align-items-center"
        @click="$emit('submit-remove', songRequest.id)"
      >
        <i class="fas mt-1 fa-times"></i>
        <span class="px-0 small mt-auto">Reject</span>
      </button>
    </div>
    <div v-else class="btn-group d-flex w-100 mt-2 border-top border-secondary" role="group">
      <button
        type="button"
        class="btn text-secondary-custom bg-tertiary-custom flex-fill w-100 px-0 py-2 d-flex flex-column align-items-center"
        @click="$emit('set-playing', songRequest.id)"
      >
        <i :class="status === 'playing' ? 'fas mt-1 fa-check' : 'fas mt-1 fa-play'"></i>
        <span class="px-0 small mt-auto">Mark as played</span>
      </button>
    </div>
  </div>
</template>
  
<script>
import { Tooltip } from 'bootstrap';

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
    emits: ['submit-comingup', 'set-playing', 'submit-remove'],
    mounted() {
      // Initialize Bootstrap tooltips
      const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.forEach((tooltipTriggerEl) => {
        // eslint-disable-next-line no-new
        new Tooltip(tooltipTriggerEl);
      });
    },
    beforeUnmount() {
      // Hide tooltips before the component is destroyed
      this.disposeTooltips();
    },
    methods: {
      openSpotifyLink(song_spotify_id) {
        // window.open(`https://open.spotify.com/track/${song_spotify_id}`, '_blank');
        window.open(`spotify:track:${song_spotify_id}`, '_blank');
      },
      disposeTooltips() {
        console.log('disposing tooltips');
        // Hide tooltips when the status changes or the component is destroyed
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.forEach((tooltipTriggerEl) => {
          const tooltip = Tooltip.getInstance(tooltipTriggerEl);
          if (tooltip) {
            tooltip.hide();
          }
        });
        // Also remove the tooltips from the DOM
        const tooltipList = [].slice.call(document.querySelectorAll('.tooltip'));
        tooltipList.forEach((tooltipEl) => {
          tooltipEl.remove();
        });
      }
  }
  }
</script>
<style scoped>
.clickable {
  cursor: pointer;
}

.shimmer {
  animation: shimmer 1.5s infinite;
  background: linear-gradient(to right, #535353 8%, #6b6b6b 18%, #535353 33%);
  background-size: 1000px 100%;
}

.loading {
  animation: loading 2.5s forwards;
  background: linear-gradient(to right, #6b6b6b 50%, #535353 50%);
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