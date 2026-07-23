import { defineStore } from "pinia";

export const modalNames = [
  "version",
  "edition",
  "fabled",
  "gameState",
  "nightOrder",
  "reference",
  "reminder",
  "role",
  "roles",
  "draw",
  "voteHistory",
  "input",
  "groupChat",
  "legal",
] as const;

export type ModalName = (typeof modalNames)[number];
export type ModalState = Record<ModalName, boolean>;

const initialState = (): ModalState =>
  Object.fromEntries(modalNames.map((name) => [name, false])) as ModalState;

export const useModalStore = defineStore("modals", {
  state: initialState,
  actions: {
    closeAll() {
      for (const name of modalNames) this[name] = false;
    },
    toggle(name?: ModalName) {
      if (!name) {
        this.closeAll();
        return;
      }

      const willOpen = !this[name];
      this.closeAll();
      this[name] = willOpen;
    },
  },
});
