import { defineStore } from "pinia";

const initialState = () => ({
  isReconnecting: false,
  playerCount: 0,
  ping: 0,
});

export const useSessionConnectionStore = defineStore("sessionConnection", {
  state: initialState,
  actions: {
    setIsReconnecting(isReconnecting: boolean) {
      this.isReconnecting = isReconnecting;
    },
    setPlayerCount(playerCount: number) {
      this.playerCount = playerCount;
    },
    setPing(ping: number) {
      this.ping = ping;
    },
  },
});
