import { defineStore } from "pinia";

type PlayersState = {
  players: any[];
  fabled: any[];
  bluffs: any[];
  firstNightOrder: any[];
  otherNightOrder: any[];
  image: string;
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
});
