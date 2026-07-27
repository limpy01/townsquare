import { defineStore } from "pinia";

const initialState = () => ({
  isReconnecting: false,
  isHostAllowed: null as boolean | null,
  isJoinAllowed: null as boolean | null,
  playerCount: 0,
  ping: 0,
});

export const useSessionConnectionStore = defineStore("sessionConnection", {
  state: initialState,
  actions: {
    setIsReconnecting(isReconnecting: boolean) {
      this.isReconnecting = isReconnecting;
    },
    setIsHostAllowed(isHostAllowed: boolean | null) {
      this.isHostAllowed = isHostAllowed;
    },
    setIsJoinAllowed(isJoinAllowed: boolean | null) {
      this.isJoinAllowed = isJoinAllowed;
    },
    setPlayerCount(playerCount: number) {
      this.playerCount = playerCount;
    },
    setPing(ping: number) {
      this.ping = ping;
    },
  },
});
