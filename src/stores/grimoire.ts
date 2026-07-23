import { defineStore } from "pinia";

type GrimoireState = {
  isNight: boolean;
  isNightOrder: boolean;
  isPublic: boolean;
  isMenuOpen: boolean;
  isStatic: boolean;
  isMuted: boolean;
  isImageOptIn: boolean;
  isForwardEvilInfo: boolean;
  zoom: number;
  background: string;
  audioThreshold: number;
};

export const useGrimoireStore = defineStore("grimoire", {
  state: (): GrimoireState => ({
    isNight: false,
    isNightOrder: true,
    isPublic: false,
    isMenuOpen: false,
    isStatic: false,
    isMuted: false,
    isImageOptIn: true,
    isForwardEvilInfo: false,
    zoom: 0,
    background: "",
    audioThreshold: 150,
  }),
  actions: {
    set<K extends keyof GrimoireState>(key: K, value: GrimoireState[K]) {
      (this as GrimoireState)[key] = value;
    },
    toggle<K extends keyof GrimoireState>(key: K, value?: boolean) {
      this[key] = (typeof value === "boolean" ? value : !this[key]) as never;
    },
  },
});
