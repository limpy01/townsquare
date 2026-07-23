import { defineStore } from "pinia";

export const useAudioStore = defineStore("audio", {
  state: () => ({
    listeningFrame: null as number | null,
  }),
  actions: {
    setListeningFrame(frame: number | null) {
      this.listeningFrame = frame;
    },
  },
});
