import { defineStore } from "pinia";

export type ChatGroupPlayer = {
  id: string;
  name?: string;
  [property: string]: unknown;
};

export const useChatStore = defineStore("chat", {
  state: () => ({
    storytellerUnread: 0,
    histories: [] as Array<{ id: string; chat: unknown[] }>,
    groups: [] as Array<{
      id: string;
      name: string;
      keep: boolean;
      players: ChatGroupPlayer[];
    }>,
  }),
  actions: {
    addGroup({
      chatId,
      players,
      keep = false,
    }: {
      chatId: string;
      players: ChatGroupPlayer[];
      keep?: boolean;
    }) {
      if (this.groups.length >= 20) return [];
      const existing = this.groups.find((group) => group.id === chatId);
      if (existing) {
        existing.players = [...existing.players, ...players];
      } else {
        const names = this.groups.map((group) => group.name);
        const used = names
          .map((name) => /^群聊(\d+)$/.exec(name)?.[1])
          .filter(Boolean)
          .map(Number);
        const suffix = Array.from({ length: 20 }, (_, index) => index + 1).find(
          (index) => !used.includes(index),
        );
        this.groups.push({
          id: chatId,
          name: names.length === 0 ? "群聊1" : `群聊${suffix ?? 21}`,
          keep,
          players,
        });
      }
      return players.map((player) => ({
        player,
        property: "chatGroup",
        value: chatId,
      }));
    },
    removeGroup(chatId: string) {
      const index = this.groups.findIndex((group) => group.id === chatId);
      if (index === -1) return [];
      const group = this.groups[index]!;
      this.groups.splice(index, 1);
      return group.players.map((player) => ({
        player,
        property: "chatGroup",
        value: "",
      }));
    },
    removeGroupMember(chatId: string, player: ChatGroupPlayer) {
      const group = this.groups.find((item) => item.id === chatId);
      if (!group) return null;
      const index = group.players.findIndex((item) => item.id === player.id);
      if (index === -1) return null;
      const [groupPlayer] = group.players.splice(index, 1);
      return groupPlayer
        ? { player: groupPlayer, property: "chatGroup", value: "" }
        : null;
    },
    toggleGroupKeep(chatId: string) {
      const group = this.groups.find((item) => item.id === chatId);
      if (group) group.keep = !group.keep;
    },
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
