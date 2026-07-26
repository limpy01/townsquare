import { defineStore } from "pinia";

export type DrawRole = {
  id: string;
} & Record<string, unknown>;

export const useDrawStore = defineStore("draw", {
  state: () => ({
    roles: [] as DrawRole[],
  }),
  actions: {
    setRoles(roles: DrawRole[]) {
      this.roles = [...roles];
    },
    clearRoles() {
      this.roles = [];
    },
  },
});
