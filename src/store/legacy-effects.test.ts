import { afterEach, describe, expect, it } from "vitest";
import { pinia } from "../pinia";
import { useGrimoireStore } from "../stores/grimoire";
import { useScenarioStore } from "../stores/scenario";
import { mutationBus } from "./mutation-bus";
import { emitLegacyMutation } from "./legacy-effects";
import { gameRuntime } from "./legacy-commands";

describe("legacy effect bridge", () => {
  afterEach(() => {
    useGrimoireStore(pinia).$reset();
    useScenarioStore(pinia).$reset();
  });

  it("emits current Pinia state for legacy effects", () => {
    const grimoire = useGrimoireStore(pinia);
    grimoire.toggle("isPublic", false);
    let received: any;
    const unsubscribe = mutationBus.subscribe((mutation, state) => {
      received = { mutation, state };
    });

    emitLegacyMutation("toggleGrimoire", false);
    unsubscribe();

    expect(received.mutation).toEqual({
      type: "toggleGrimoire",
      payload: false,
    });
    expect(received.state.grimoire.isPublic).toBe(false);
  });

  it("projects scenario fields required by the session transport", () => {
    const scenario = useScenarioStore(pinia);
    scenario.setStates(["drunk"]);
    scenario.setTeamsNames({ townsfolk: "Town" });
    scenario.setFirstNight(["washerwoman"]);
    scenario.setOtherNight(["imp"]);

    expect(gameRuntime.state).toMatchObject({
      states: ["drunk"],
      teamsNames: { townsfolk: "Town" },
      firstNight: ["washerwoman"],
      otherNight: ["imp"],
    });
  });
});
