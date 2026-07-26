import { defineStore } from "pinia";
import { pinia } from "../pinia";
import { useProfileStore } from "./profile";
import { useSessionSettingsStore } from "./session-settings";
import { useSessionIdentityStore } from "./session-identity";
import { useVotingStore } from "./voting";

export type GameRole = Record<string, unknown> & {
  id: string;
  name?: string;
  team?: string;
  ability?: string;
  firstNightReminder?: string;
  otherNightReminder?: string;
  reminders?: string[];
};

export type MutablePlayer = Record<string, unknown> & {
  id?: string;
  votes?: number;
};

type PlayersState = {
  players: any[];
  fabled: GameRole[];
  bluffs: GameRole[];
  firstNightOrder: string[];
  otherNightOrder: string[];
  image: string;
};

type SetFabledPayload = {
  index?: number;
  fabled?: unknown;
  stImage?: string;
  stName?: string;
  emptyFabled?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asGameRole = (value: unknown): GameRole | null =>
  isRecord(value) && typeof value.id === "string" ? (value as GameRole) : null;

const createPlayer = (name = "") => ({
  name,
  id: "",
  image: "",
  role: {},
  isAllowRole: true,
  isWraith: false,
  isUsingWraith: false,
  reminders: [],
  stReminders: [],
  isVoteless: false,
  isSecretVoteless: false,
  isDead: false,
  votes: 1,
  pronouns: "",
  newMessages: 0,
  chatGroup: "",
  isTalking: false,
});

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
    add(name = "") {
      const player = createPlayer(name);
      this.players.push(player);
      return player;
    },
    setPlayers(players: unknown[] = []) {
      this.players = players;
    },
    clear(emptyFabled = false) {
      this.players = [];
      this.bluffs = [];
      this.setFabled({ fabled: [], emptyFabled });
    },
    remove(index: number) {
      this.players.splice(index, 1);
    },
    swap([from, to]: [number, number]) {
      [this.players[from], this.players[to]] = [
        this.players[to],
        this.players[from],
      ];
      this.players.splice(0, 0);
    },
    move([from, to]: [number, number]) {
      const [player] = this.players.splice(from, 1);
      if (player) this.players.splice(to, 0, player);
    },
    randomize() {
      this.players = this.players
        .map((player) => [Math.random(), player] as const)
        .sort(([left], [right]) => left - right)
        .map(([, player]) => player);
    },
    clearRoles(isSpectator: boolean) {
      if (isSpectator) {
        this.players.forEach((player) => {
          if (player.role.team !== "traveler") player.role = {};
          player.reminders = [];
        });
      } else {
        this.players = this.players.map(
          ({ name, id, pronouns, image, chatGroup }) => ({
            ...createPlayer(),
            name,
            id,
            pronouns,
            image,
            chatGroup,
          }),
        );
        this.setFabled({ fabled: [] });
      }
      this.setBluff();
    },
    realivePlayers() {
      this.players.forEach((player) => {
        this.update({ player, property: "isDead", value: false });
      });
    },
    update({
      player,
      property,
      value,
    }: {
      player: MutablePlayer;
      property: string;
      value: unknown;
    }) {
      if (this.players.includes(player)) player[property] = value;
      if (player.id !== useSessionIdentityStore(pinia).playerId) return;
      if (property === "id" && typeof player.votes === "number") {
        useVotingStore(pinia).setPlayerVotes(player.votes);
      } else if (property === "votes" && typeof value === "number") {
        useVotingStore(pinia).setPlayerVotes(value);
      }
    },
    setBluff({ index, role }: { index?: number; role?: unknown } = {}) {
      if (index === undefined) {
        this.bluffs = [];
        return;
      }
      const normalizedRole = asGameRole(role);
      if (!normalizedRole) return;
      this.bluffs.splice(index, 1, normalizedRole);
    },
    setPlayerMessage({ playerId, num }: { playerId: string; num: number }) {
      const player = this.players.find((item) => item.id === playerId);
      if (!player) return;
      player.newMessages = num > 0 ? player.newMessages + num : num;
    },
    setTalking({
      seatNum,
      isTalking,
      playerId,
    }: {
      seatNum: number;
      isTalking: boolean;
      playerId: string;
    }) {
      const player = this.players[seatNum];
      if (!player || !player.id || player.id !== playerId) return;
      player.isTalking = isTalking;
    },
    empty(player: MutablePlayer) {
      const changes = [
        ["id", ""],
        ["name", ""],
        ["image", ""],
        ["isWraith", false],
        ["isUsingWraith", false],
      ] as const;
      return changes.map(([property, value]) => {
        const payload = { player, property, value };
        this.update(payload);
        return payload;
      });
    },
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

      const storyteller: GameRole = {
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
      const selectedFabled = Array.isArray(fabled)
        ? fabled.flatMap((role) => {
            const normalized = asGameRole(role);
            return normalized ? [normalized] : [];
          })
        : asGameRole(fabled);
      if (!selectedFabled) return;
      if (
        !Array.isArray(selectedFabled) &&
        selectedFabled.id === "bootlegger" &&
        customBootlegger
      ) {
        selectedFabled.ability = customBootlegger;
      }
      if (
        Array.isArray(selectedFabled) &&
        selectedFabled.length === 0 &&
        this.fabled.length
      ) {
        const bootleggerIndex = this.fabled.findIndex(
          (role) => role.id === "bootlegger",
        );
        if (bootleggerIndex > 0) this.setFabled({ index: bootleggerIndex });
      }
      if (!Array.isArray(selectedFabled)) {
        this.fabled.push(selectedFabled);
        return;
      }
      if (
        !emptyFabled &&
        ((selectedFabled.length > 0 &&
          selectedFabled[0]?.id !== "storyteller") ||
          selectedFabled.length === 0)
      ) {
        selectedFabled.unshift(storyteller);
      }
      this.fabled = selectedFabled;
    },
  },
});
