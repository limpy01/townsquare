import { afterEach, describe, expect, it, vi } from "vitest";
import { pinia } from "../pinia";
import { useGrimoireStore } from "../stores/grimoire";
import { useScenarioStore } from "../stores/scenario";
import {
  createGameEventChannel,
  emitGameEvent,
  gameEvents,
  getGameEffectState,
} from "./game-events";
import { gameRuntime } from "./legacy-commands";

describe("game event channel", () => {
  afterEach(() => {
    useGrimoireStore(pinia).$reset();
    useScenarioStore(pinia).$reset();
  });

  it("delivers explicit events and can unsubscribe listeners", () => {
    const channel = createGameEventChannel<{ active: boolean }>();
    const subscriber = vi.fn();
    const unsubscribe = channel.subscribe(subscriber);

    channel.publish({ type: "toggleNight", payload: true }, { active: true });
    unsubscribe();
    channel.publish({ type: "toggleNight", payload: false }, { active: false });

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith(
      { type: "toggleNight", payload: true },
      { active: true },
    );
  });

  it("publishes the current Pinia projection for external effects", () => {
    const grimoire = useGrimoireStore(pinia);
    const scenario = useScenarioStore(pinia);
    grimoire.toggle("isPublic", false);
    scenario.setStates(["drunk"]);
    scenario.setTeamsNames({ townsfolk: "Town" });
    scenario.setFirstNight(["washerwoman"]);
    scenario.setOtherNight(["imp"]);
    const subscriber = vi.fn();
    const unsubscribe = gameEvents.subscribe(subscriber);

    emitGameEvent("toggleGrimoire", false);
    unsubscribe();

    expect(subscriber).toHaveBeenCalledWith(
      { type: "toggleGrimoire", payload: false },
      expect.objectContaining({
        grimoire: expect.objectContaining({ isPublic: false }),
      }),
    );
    expect(getGameEffectState()).toMatchObject({
      edition: scenario.edition,
    });
    expect(gameRuntime.state).toMatchObject({
      states: ["drunk"],
      teamsNames: { townsfolk: "Town" },
      firstNight: ["washerwoman"],
      otherNight: ["imp"],
    });
  });
});
