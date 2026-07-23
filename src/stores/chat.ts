import { defineStore } from "pinia";

export const useChatStore = defineStore("chat", {
  state: () => ({
    storytellerUnread: 0,
    histories: [] as Array<{ id: string; chat: unknown[] }>,
  }),
  actions: {
    addStorytellerUnread(amount: number) {
      if (amount > 0) this.storytellerUnread += amount;
    },
    clearStorytellerUnread() {
      this.storytellerUnread = 0;
    },
    createHistory(playerId: string) {
      if (
        !playerId ||
        this.histories.some((history) => history.id === playerId)
      )
        return;
      this.histories.push({ id: playerId, chat: [] });
    },
    addReceivedMessage({
      message,
      playerId,
    }: {
      message: unknown;
      playerId: string;
    }) {
      const index = this.histories.findIndex(
        (history) => history.id === playerId,
      );
      if (index === -1) return;
      const history = this.histories[index];
      if (!history) return;
      history.chat = [...history.chat, message];
    },
  },
});
