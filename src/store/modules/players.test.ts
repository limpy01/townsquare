import { describe, expect, it, vi } from "vitest";
import { pinia } from "../../pinia";
import { usePlayersStore } from "../../stores/players";
import playersModule from "./players";

describe("players Vuex compatibility module", () => {
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
