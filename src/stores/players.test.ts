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

  it("updates player properties and bluff slots", () => {
    const players = usePlayersStore();
    const player = { id: "player-1", role: {} };
    players.players = [player];

    players.update({ player, property: "role", value: { id: "imp" } });
    players.setBluff({ index: 0, role: { id: "chef" } });

    expect(player.role).toEqual({ id: "imp" });
    expect(players.bluffs).toEqual([{ id: "chef" }]);
  });

  it("clears a seated player while preserving their game role", () => {
    const players = usePlayersStore();
    const player = {
      id: "player-1",
      name: "Alice",
      image: "avatar.webp",
      isWraith: true,
      isUsingWraith: true,
      role: { id: "imp" },
    };
    players.players = [player];

    players.empty(player);

    expect(player).toMatchObject({
      id: "",
      name: "",
      image: "",
      isWraith: false,
      isUsingWraith: false,
      role: { id: "imp" },
    });
  });

  it("adds and replaces player seats", () => {
    const players = usePlayersStore();
    players.add("Alice");
    players.setPlayers([{ name: "Bob", role: {} }]);

    expect(players.players).toEqual([{ name: "Bob", role: {} }]);
  });
});
