import { defineStore } from "pinia";

export const useSessionSettingsStore = defineStore("session-settings", {
  state: () => ({
    bootlegger: "",
  }),
  actions: {
    setBootlegger(bootlegger: string) {
      this.bootlegger = bootlegger;
    },
  },
});
