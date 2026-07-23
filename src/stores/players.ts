import { defineStore } from "pinia";
import { pinia } from "../pinia";
import { useProfileStore } from "./profile";
import { useSessionSettingsStore } from "./session-settings";

type PlayersState = {
  players: any[];
  fabled: any[];
  bluffs: any[];
  firstNightOrder: any[];
  otherNightOrder: any[];
  image: string;
};

type SetFabledPayload = {
  index?: number;
  fabled?: any;
  stImage?: string;
  stName?: string;
  emptyFabled?: boolean;
};

export const usePlayersStore = defineStore("players", {
  state: (): PlayersState => ({
    players: [],
    fabled: [],
    bluffs: [],
    firstNightOrder: [],
    otherNightOrder: [],
    image: "",
  }),
  actions: {
    setFabled({
      index,
      fabled,
      stImage,
      stName,
      emptyFabled = false,
    }: SetFabledPayload = {}) {
      const profile = useProfileStore(pinia);
      if (!stImage) {
        stImage =
          profile.playerAvatar === "default.webp"
            ? "default_storyteller.webp"
            : profile.playerAvatar;
      }
      if (!stName) stName = profile.playerName;
      if (index !== undefined) {
        if (index === 0) return;
        if (this.fabled[index]?.id === "bootlegger") {
          this.fabled[index].ability = "这个剧本包含有自制角色或自制规则。";
        }
        this.fabled.splice(index, 1);
        return;
      }
      if (!fabled) return;

      const storyteller = {
        id: "storyteller",
        image: "https://botcgrimoire.top/avatars/" + stImage,
        firstNightReminder: "",
        otherNightReminder: "",
        reminders: [],
        setup: false,
        name: stName,
        team: "fabled",
        ability: "点击和说书人私聊。",
      };
      const customBootlegger = useSessionSettingsStore(pinia).bootlegger;
      if (fabled.id === "bootlegger" && customBootlegger) {
        fabled.ability = customBootlegger;
      }
      if (Array.isArray(fabled) && fabled.length === 0 && this.fabled.length) {
        const bootleggerIndex = this.fabled.findIndex(
          (role) => role.id === "bootlegger",
        );
        if (bootleggerIndex > 0) this.setFabled({ index: bootleggerIndex });
      }
      if (!Array.isArray(fabled)) {
        this.fabled.push(fabled);
        return;
      }
      if (
        !emptyFabled &&
        ((fabled.length > 0 && fabled[0].id !== "storyteller") ||
          fabled.length === 0)
      ) {
        fabled.unshift(storyteller);
      }
      this.fabled = fabled;
    },
  },
});
