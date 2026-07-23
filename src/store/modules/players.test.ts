import { describe, expect, it, vi } from "vitest";
import { pinia } from "../../pinia";
import { usePlayersStore } from "../../stores/players";
import playersModule from "./players";

describe("players Vuex compatibility module", () => {
  it("calculates night order for player and fabled roles", () => {
    const state = playersModule.state();
    const player = {
      id: "player-a",
      role: { id: "washerwoman", firstNight: 1, otherNight: 1 },
    };
    const fabled = { id: "dawn", firstNight: 2, otherNight: 3 };
    state.players = [player];
    state.fabled = [fabled];

    expect(state.players).toEqual([player]);
    expect(state.fabled).toEqual([fabled]);

    const nightOrder = playersModule.getters.nightOrder(state);

    expect(nightOrder.get(state.players[0])).toEqual({ first: 1, other: 1 });
    expect(nightOrder.get(state.fabled[0])).toEqual({ first: 2, other: 2 });
  });

  it("updates the local player and mirrors vote changes to the session", () => {
    const state = playersModule.state();
    const player = { id: "player-a", votes: 1 };
    state.players = [player];
    const commit = vi.fn();

    playersModule.mutations.update.call(
      { state: { session: { playerId: "player-a" } }, commit },
      state,
      { player, property: "votes", value: 0 },
    );

    expect(player.votes).toBe(0);
    expect(commit).toHaveBeenCalledWith("players/selfUpdate", {
      player,
      property: "votes",
      value: 0,
    });
  });

  it("projects the Pinia player state for legacy consumers", () => {
    const state = playersModule.state();

    expect(state.players).toBe(usePlayersStore(pinia).players);
  });
});
