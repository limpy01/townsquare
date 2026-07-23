import { defineStore } from "pinia";

export const useChatStore = defineStore("chat", {
  state: () => ({
    storytellerUnread: 0,
  }),
  actions: {
    addStorytellerUnread(amount: number) {
      if (amount > 0) this.storytellerUnread += amount;
    },
    clearStorytellerUnread() {
      this.storytellerUnread = 0;
    },
  },
});
