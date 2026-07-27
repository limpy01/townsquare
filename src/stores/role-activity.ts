import { defineStore } from "pinia";

export type WraithProperty =
  | "active"
  | "using"
  | "st"
  | "player"
  | "prob"
  | "probMax";

export const useRoleActivityStore = defineStore("role-activity", {
  state: () => ({
    wraith: {
      active: false,
      using: false,
      st: 0,
      player: 0,
      prob: 0.05,
      probMax: 0.1,
    },
  }),
  actions: {
    setRole({
      role,
      property,
      value,
      st,
    }: {
      role: "wraith";
      property: WraithProperty;
      value: boolean | number;
      st?: boolean;
    }) {
      if (property === "using" && !st) return;
      this[role][property] = value as never;
    },
  },
});
