<template>
  <div
    id="aiSettingsModal"
    class="modal fade"
    tabindex="-1"
    aria-labelledby="aiSettingsModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog">
      <div class="modal-content bg-dark text-light">
        <div class="modal-header border-secondary">
          <h5 id="aiSettingsModalLabel" class="modal-title">AI Settings</h5>
          <button
            type="button"
            class="btn-close btn-close-white"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <label for="aiPrompt" class="form-label lead text-light custom-label">Here you can set your own custom AI prompt. The prompt will act as instructions for the AI model when deciding whether to accept a song or not. Please make sure to keep the beginning and end of the prompt. Modify the rules as needed. For example, if you do not want to accept any rap songs, simply write a new rule: "No rap music"</label>
          <textarea
            id="aiPrompt"
            v-model="localAIPrompt"
            class="form-control bg-secondary text-light border-secondary custom-textarea"
            rows="20"
          ></textarea>
        </div>
        <div class="modal-footer border-secondary">
            <button
            type="button"
            class="btn btn-outline-light"
            @click="resetToDefault"
          >
            Reset to Default
          </button>
          <button
            type="button"
            class="btn btn-outline-light"
            data-bs-dismiss="modal"
          >
            Close
          </button>
          <button
            type="button"
            class="btn btn-primary"
            @click="saveAIPrompt"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Modal } from 'bootstrap';

export default {
  data() {
    return {
        defaultPrompt: `You are a song vetting assistant for a bar in Stockholm, Sweden. Your main role is to filter out songs that are clearly out of place in a lively, social nightlife setting. The goal is to only reject songs that are likely to feel awkward, alienating, or disruptive to the atmosphere.

Only reject a song if it is clearly a poor fit. Good reasons to reject include:
	1.	Extremely bad mood fit:
	•	Overwhelmingly sad or emotional ballads.
	•	Very slow, ambient, or non-rhythmic music (e.g., classical, film scores, slow piano, lo-fi).
	•	Harsh or aggressive genres like hardstyle, death metal, or screamo.
	2.	Meme or joke songs that people might request ironically (e.g., “Baby Shark”, “Crazy Frog”, “The Duck Song”).
    3.  Any songs with clearly childish titles, intended for children (Also consider this for other languages).
	4.	Songs in niche languages (e.g., Arabic, Korean, Hindi) that aren’t globally popular or recognizable. Swedish and English are preferred, but international hits are okay.
	5.	Obscure and unrecognizable songs — if the popularity is very low (e.g., below 30) it should most likely be rejected.
	6.	Extremely long tracks (e.g., 300 seconds), unless they are widely known and worth the runtime.
	7.	Overtly explicit songs that might make the room uncomfortable unless they are known hits.
    8.  Reject any song associated with hate groups, war propaganda, or ideologies that are inappropriate or offensive in a public setting (e.g., Nazi music, extremist anthems). Even if these songs seem neutral based on genre or metadata, they must be blocked.
    9.  Reject any live versions / live recordings of songs
    10.  Reject any track that does not seem to be a song (e.g., podcasts, audiobooks, or other non-musical content).
    11.  No gangster rap, trap, or any other genre that promotes violence.
    12.  Be extra cautious with songs that do not have any last.fm metadata, as they are likely to be obscure or unrecognizable.

Reject the following genres (among others): Lo-fi, classical, ambient, film scores, slow piano, hardstyle, death metal, screamo.

Also reject any other genres that are not suitable for a lively nightlife setting.

Otherwise, accept the song. A wide variety of pop, dance, electronic, hip hop, rock, house, and indie songs are welcome.

Reject only what clearly stands out as a bad choice.

You will have access to the following information about the song:
Title & Artist:
Artist Genres (if available):
Duration (In seconds):
Popularity (0-100):
Explicit (True/False):
Last.fm tags (if available):
Last.fm track wiki (if available):
Last.fm artist wiki (if available):

Start the response with a chain of reasoning where all the points/rules are considered, then accepted (true/false), and lastly a final short reasoning for the decision.
`,
        localAIPrompt: "",
    };
  },
    mounted() {
        this.fetchAIPrompt();
    },
  methods: {
    async saveAIPrompt() {
      try {
        const response = await fetch("/api/aimode/prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ai_prompt: this.localAIPrompt }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(data.message); // "Custom AI prompt updated successfully"
          const modalElement = document.getElementById('aiSettingsModal');
          const modalInstance = Modal.getInstance(modalElement);
          modalInstance.hide();
 
        } else {
          const errorData = await response.json();
          console.error("Failed to update AI prompt:", errorData.message);
        }
      } catch (error) {
        console.error("Error updating AI prompt:", error);
      }
    },
    resetToDefault() {
      this.localAIPrompt = this.defaultPrompt;
    },
    async fetchAIPrompt() {
      try {
        const response = await fetch("/api/aimode/prompt", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const data = await response.json();
          this.localAIPrompt = data.ai_prompt || this.defaultPrompt;
        } else {
          console.error("Failed to fetch AI prompt");
          this.localAIPrompt = this.defaultPrompt;
        }
      } catch (error) {
        console.error("Error fetching AI prompt:", error);
        this.localAIPrompt = this.defaultPrompt;
      }
    },
  },
};
</script>

<style scoped>
.custom-label {
  font-size: 0.95rem; /* Smaller font size for the label */
}

.custom-textarea {
  font-size: 0.8rem; /* Smaller font size for the textarea */
}
</style>