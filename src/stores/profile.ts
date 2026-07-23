import { defineStore } from "pinia";

export const useProfileStore = defineStore("profile", {
  state: () => ({
    playerName: "",
    playerAvatar: "default.webp",
  }),
  actions: {
    setPlayerName(playerName: string) {
      this.playerName = playerName;
    },
    resetPlayerAvatar() {
      this.playerAvatar = "";
    },
    updatePlayerAvatar(playerAvatar: string) {
      this.playerAvatar = playerAvatar;
    },
  },
});
