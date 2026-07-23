import { defineStore } from "pinia";

export const useDrawStore = defineStore("draw", {
  state: () => ({
    roles: [] as any[],
  }),
  actions: {
    setRoles(roles: any[]) {
      this.roles = [...roles];
    },
    clearRoles() {
      this.roles = [];
    },
  },
});
