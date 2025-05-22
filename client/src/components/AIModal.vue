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
        <div class="modal-header border-dark">
          <h5 id="aiSettingsModalLabel" class="modal-title">AI Settings</h5>
          <button
            type="button"
            class="btn-close btn-close-white"
            data-bs-dismiss="modal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body pt-0 pb-1">
          <label for="aiPrompt" class="form-label custom-label pb-2">Here you can set your own custom AI prompt. The prompt will act as instructions for the AI model when deciding whether to accept a song or not. Please make sure to keep the beginning and end of the prompt. Modify the rules as needed. For example, if you do not want to accept any rap songs, simply write a new rule: "No rap music"</label>
          <textarea
            id="aiPrompt"
            v-model="localAIPrompt"
            class="form-control border-dark custom-textarea"
            rows="20"
          ></textarea>
        </div>
        <div class="modal-footer border-dark p-0">
          <div class="btn-group w-100 p-3 shadow" role="group">
            <button
              type="button"
              class="btn text-light btn-reset-gray"
              @click="resetToDefault"
            >
              <i class="fas fa-undo me-1"></i>
              Reset to Default
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click="saveAIPrompt"
            >
              <i class="fas fa-save me-2"></i>
              Save Changes
            </button>
          </div>
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

Good reasons to reject include the following rules:
1.	Extremely bad mood fit:
•	Overwhelmingly sad or emotional ballads.
•	Very slow, ambient, or non-rhythmic music (e.g., classical, film scores, slow piano, lo-fi, soundtracks, ambient).
•	Harsh or aggressive genres like hardstyle, death metal, or screamo.
2.	Meme or joke songs that people might request ironically (e.g., “Baby Shark”, “Crazy Frog”, “The Duck Song”). Also avoid any genres, tags, track descriptions, and artist descriptions indicating this, such as "humor, meme, non-serious, joke, parody"
3.  Any songs with clearly childish titles, intended for children (Also consider this for other languages).
4.	Songs in niche languages (e.g., Arabic, Korean, Hindi) that aren’t globally popular or recognizable. Swedish and English are preferred, but international hits are okay.
5.	Obscure and unrecognizable songs — if the popularity is very low (e.g., below 30) it should most likely be rejected.
6.	Extremely long tracks. Above 5 minutes (300 seconds) is too long, unless it is an extremely popular and well known track. Anything above 6 minutes (360 seconds), should always be rejected. If this is the reason for rejection, suggest finding a shorter version/radio edit in the response reason.
7.	Overtly explicit songs that might make the room uncomfortable unless they are known hits.
8.  Reject any song associated with hate groups, war propaganda, or ideologies that are inappropriate or offensive in a public setting (e.g., Nazi music, extremist anthems). Even if these songs seem neutral based on genre or metadata, they must be blocked.
9.  Reject any live versions / live recordings of songs
10. Reject any track that does not seem to be a song (e.g., podcasts, audiobooks, or other non-musical content).
11. No gangster rap, trap, or any other genre that promotes violence.
12. Reject tracks linked to racism

Be extra cautious with songs that do not have any last.fm metadata, as they are likely to be obscure or unrecognizable.

Do not let a high popularity score override any of the rules listed above. If any rule is broken (or risks being broken), the song MUST BE REJECTED. One broken rule is enough.

Reject the following genres (among others): Lo-fi, classical, ambient, film scores, slow piano, hardstyle, death metal, screamo, hip hop, swedish ganster rap, swedish gangster hip hop, gangster hip hop, epadunk, dubstep.

Also reject any other genres that are not suitable for a lively nightlife setting.

When deciding, try to consider which tracks have been recently played. Do not play the same artist twice in a row. Also, look at the recently played tags, the requested song should be atleast somewhat similar in terms of tags. For example, if all the last played tags are rock, 80s, pop, e.t.c, do not suddenly play dubstep, as that might disrupt the atmosphere.

Otherwise, accept the song. A wide variety of pop, dance, electronic, rock, house, and indie songs are welcome.

You will have access to the following information about the song:
Title:
Artist:
Artist Genres (if available):
Duration (In seconds):
Spotify Popularity Score (0-100):
Explicit (True/False):
Last.fm tags (if available):
Last.fm track wiki (if available):
Last.fm artist wiki (if available):

Additionally, your will have information about the last played tracks, artists and tags.

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
  font-size: 0.9rem; /* Smaller font size for the label */
  color: #a8a8a8; /* Soft light gray for label/paragraph */
}

.custom-textarea {
  font-size: 0.8rem; /* Smaller font size for the textarea */
  color: #c8c8cb; /* Light gray for textarea text */
  background-color: #41464b; /* Dark background for textarea */
}
.btn-reset-gray {
  background-color: #3a3a3a;
  color: #e0e0e0;
  border: 1px solid #444;
  transition: background 0.2s, color 0.2s;
}
.btn-reset-gray:hover,
.btn-reset-gray:focus {
  background-color: #505050;
  color: #fff;
  border-color: #666;
}
</style>