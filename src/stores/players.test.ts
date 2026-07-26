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

  it("moves and swaps seats without losing player records", () => {
    const players = usePlayersStore();
    players.setPlayers([
      { id: "a", name: "Alice", role: {} },
      { id: "b", name: "Bob", role: {} },
      { id: "c", name: "Carol", role: {} },
    ]);

    players.move([0, 2]);
    players.swap([0, 1]);

    expect(players.players.map((player) => player.id)).toEqual(["c", "b", "a"]);
  });

  it("preserves traveler roles when a spectator clears role details", () => {
    const players = usePlayersStore();
    players.setPlayers([
      {
        id: "traveler",
        role: { id: "barista", team: "traveler" },
        reminders: [{ name: "old" }],
      },
      {
        id: "townsfolk",
        role: { id: "chef", team: "townsfolk" },
        reminders: [{ name: "old" }],
      },
    ]);

    players.clearRoles(true);

    expect(players.players).toMatchObject([
      { role: { id: "barista" }, reminders: [] },
      { role: {}, reminders: [] },
    ]);
    expect(players.bluffs).toEqual([]);
  });

  it("tracks message and talking state only for the matching seat", () => {
    const players = usePlayersStore();
    players.setPlayers([
      { id: "alice", role: {}, newMessages: 0, isTalking: false },
      { id: "bob", role: {}, newMessages: 0, isTalking: false },
    ]);

    players.setPlayerMessage({ playerId: "alice", num: 2 });
    players.setPlayerMessage({ playerId: "alice", num: 1 });
    players.setPlayerMessage({ playerId: "bob", num: 0 });
    players.setTalking({ seatNum: 0, playerId: "bob", isTalking: true });
    players.setTalking({ seatNum: 1, playerId: "bob", isTalking: true });

    expect(players.players).toMatchObject([
      { id: "alice", newMessages: 3, isTalking: false },
      { id: "bob", newMessages: 0, isTalking: true },
    ]);
  });
});
