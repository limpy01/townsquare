import { defineStore } from "pinia";

export const useAudioStore = defineStore("audio", {
  state: () => ({
    listeningFrame: null as number | null,
    isTalking: false,
  }),
  actions: {
    setListeningFrame(frame: number | null) {
      this.listeningFrame = frame;
    },
    setTalking(isTalking: boolean) {
      this.isTalking = isTalking;
    },
  },
});
