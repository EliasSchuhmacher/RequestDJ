<!-- eslint-disable camelcase -->
<template>
  <div
    :class="['card my-2 shadow rounded bg-tertiary-custom', 
    { shimmer: status === 'coming_up', loading: status === 'playing' }]"
  >
    <div class="px-2 my-2 d-flex align-items-center position-relative">
      <!-- Album Image -->
      <div class="me-2">
        <img 
          v-if="songRequest.song_image_url" 
          :src="songRequest.song_image_url" 
          :class="['img rounded', incoming ? 'album-image-large' : 'album-image']"
          alt="Album cover"
        >
        <div 
          v-else 
          :class="['d-flex align-items-center justify-content-center', incoming ? 'album-image-placeholder-large' : 'album-image-placeholder']"
        > 
          <!-- <i class="fas fa-music"></i> -->
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
        <span v-if="songRequest.song_genre" class="small text-break me-2">
          {{ songRequest.song_genre }}
        </span>
        <span v-if="songRequest.requester_name" class="small me-2">
          <strong>Requested by: </strong>{{ songRequest.requester_name }}
        </span>
        <span v-if="timeAgo" class="time-ago small ms-auto z-3 bg-tertiary-custom rounded-pill">
          <i class="fas fa-clock me-1"></i>{{ timeAgo }}
        </span>

        <!-- Song Genre and Time Ago-->
        <!-- <div class="d-flex justify-content-between">
          <span v-if="songRequest.song_genre" class="small text-break me-2">
            {{ songRequest.song_genre }}
          </span>
          <span v-if="timeAgo && !songRequest.requester_name" class="time-ago small ms-auto">
            <i class="fas fa-clock me-1"></i>{{ timeAgo }}
          </span>
        </div> -->

        <!-- Requester Name and Time Ago -->
        <!-- <div v-if="songRequest.requester_name" class="d-flex justify-content-between">
          <span class="small me-2">
            <strong>Requested by: </strong>{{ songRequest.requester_name }}
          </span>
          <span v-if="timeAgo" class="time-ago small ms-auto">
            <i class="fas fa-clock me-1"></i>{{ timeAgo }}
          </span>
        </div> -->
      </div>
    </div>

    <!-- Buttons -->
    <div v-if="incoming" class="btn-group d-flex w-100 border-top border-secondary" role="group">
      <button
        type="button"
        class="btn btn-outline-secondary border-0 text-secondary-custom flex-fill w-100 px-0 py-2 d-flex flex-column align-items-center"
        @click="$emit('submit-comingup', songRequest.id)"
      >
        <i class="fas mt-1 fa-check"></i>
        <span class="px-0 small mt-auto">Accept & Queue</span>
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary border-0 text-primary-custom flex-fill w-100 px-0 py-2 d-flex flex-column align-items-center"
        @click="$emit('submit-remove', songRequest.id)"
      >
        <i class="fas mt-1 fa-times"></i>
        <span class="px-0 small mt-auto">Reject</span>
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
    data() {
      return {
        timeAgo: ''
      };
    },
    mounted() {
      this.updateTimeAgo();
      this.timeAgoTimer = setInterval(this.updateTimeAgo, 60000); // update every 60 seconds

      // Initialize Bootstrap tooltips
      const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.forEach((tooltipTriggerEl) => {
        // eslint-disable-next-line no-new
        new Tooltip(tooltipTriggerEl);
      });
    },
    beforeUnmount() {
      // Clear the timer when the component is destroyed
      clearInterval(this.timeAgoTimer);
      // Hide tooltips before the component is destroyed
      this.disposeTooltips();
    },
    methods: {
      updateTimeAgo() {
        const now = new Date();
        const requestDate = new Date(this.songRequest.request_date);
        const diffMs = now - requestDate;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHr = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHr / 24);

        if (diffSec < 60) {
          this.timeAgo = 'just now';
        } else if (diffMin < 60) {
          this.timeAgo = `${diffMin} min ago`;
        } else if (diffHr < 24) {
          this.timeAgo = `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
        } else {
          this.timeAgo = `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
        }
      },
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

.time-ago {
  color: #b0b0b0; /* Slightly lighter gray for better readability */
  position: absolute;
  bottom: -0.2rem;
  right: 0.5rem;
  padding-left: 2px;
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