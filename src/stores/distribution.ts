import { defineStore } from "pinia";

export const useDistributionStore = defineStore("distribution", {
  state: () => ({
    roles: false,
    types: false,
    bluffs: false,
    grimoire: false,
  }),
  actions: {
    setRoles(active: boolean) {
      this.roles = active;
    },
    setTypes(active: boolean) {
      this.types = active;
    },
    setBluffs(active: boolean) {
      this.bluffs = active;
    },
    setGrimoire(active: boolean) {
      this.grimoire = active;
    },
  },
});
