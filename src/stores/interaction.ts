import { defineStore } from "pinia";

const initialState = () => ({
  isChatOpen: false,
  isTyping: false,
});

export const useInteractionStore = defineStore("interaction", {
  state: initialState,
  actions: {
    setChatOpen(isOpen: boolean) {
      this.isChatOpen = isOpen;
    },
    setTyping(isTyping: boolean) {
      this.isTyping = isTyping;
    },
  },
});
