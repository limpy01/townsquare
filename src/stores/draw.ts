import { defineStore } from "pinia";

export const useDrawStore = defineStore("draw", {
  state: () => ({
    roles: [] as unknown[],
  }),
  actions: {
    setRoles(roles: unknown[]) {
      this.roles = [...roles];
    },
    clearRoles() {
      this.roles = [];
    },
  },
});
