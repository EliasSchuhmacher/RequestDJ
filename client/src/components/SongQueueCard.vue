<!-- eslint-disable camelcase -->
<template>
  <div
    :class="['card my-2 shadow rounded bg-tertiary-custom', 
    { shimmer: status === 'coming_up', loading: status === 'playing' }]"
  >
    <div class="px-2 my-2 d-flex align-items-center">
      <!-- Album Image -->
      <div class="me-2">
        <img 
          v-if="songRequest.song_image_url" 
          :src="songRequest.song_image_url" 
          class="img rounded album-image"
          alt="Album cover"
        >
        <div
          v-else
          class="d-flex align-items-center justify-content-center album-image-placeholder"
        >
        </div>
      </div>

      <!-- Song Title and Artist -->
      <div class="d-flex flex-column w-100">
        <span
          v-if="songRequest.song_spotify_id"
          class="small clickable overflow-hidden"
          data-bs-toggle="tooltip"
          title="Click to open in Spotify"
          @click="openSpotifyLink(songRequest.song_spotify_id)" 
          @keydown.enter="openSpotifyLink(songRequest.song_spotify_id)"
        >
          <strong>{{ songRequest.song_title }}</strong>
        </span>
        <span v-else class="small overflow-hidden">
          <strong>{{ songRequest.song_title }}</strong>
        </span>
        <span v-if="songRequest.song_artist" class="small">
          {{ songRequest.song_artist }}
        </span>
      </div>
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

.album-image {
  width: 48px; /* Fixed width */
  height: 48px; /* Fixed height */
  object-fit: cover; /* Ensures the image scales properly without distortion */
}

.album-image-large {
  width: 64px; /* Larger size for incoming status */
  height: 64px;
  object-fit: cover;
}

.album-image-placeholder {
  width: 48px;
  /* height: 48px; */
}

.album-image-placeholder-large {
  width: 64px;
  /* height: 64px; */
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