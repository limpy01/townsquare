import { defineStore } from "pinia";

export const useSessionIdentityStore = defineStore("session-identity", {
  state: () => ({
    sessionId: "",
    stId: null as string | null,
    stSecret: "",
    isSpectator: false,
    playerId: "",
    claimedSeat: -1,
  }),
  actions: {
    setSessionId(sessionId: string) {
      this.sessionId = sessionId
        .toLocaleLowerCase()
        .replace(/[^0-9a-z]/g, "")
        .slice(0, 10);
    },
    setStId(stId: string | null) {
      this.stId = stId;
    },
    setStSecret(stSecret: string) {
      this.stSecret = stSecret;
    },
    setSpectator(isSpectator: boolean) {
      this.isSpectator = isSpectator;
    },
    setPlayerId(playerId: string) {
      this.playerId = playerId;
    },
    claimSeat(claimedSeat: number) {
      this.claimedSeat = claimedSeat;
    },
  },
});
