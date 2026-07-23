import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { usePlayersStore } from "./players";

describe("players store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("initializes game participant state", () => {
    const players = usePlayersStore();

    expect(players.players).toEqual([]);
    expect(players.fabled).toEqual([]);
    expect(players.bluffs).toEqual([]);
    expect(players.firstNightOrder).toEqual([]);
    expect(players.otherNightOrder).toEqual([]);
  });

  it("adds the selected fabled role", () => {
    const players = usePlayersStore();
    players.setFabled({ fabled: { id: "bootlegger", ability: "default" } });

    expect(players.fabled).toEqual([{ id: "bootlegger", ability: "default" }]);
  });
});
