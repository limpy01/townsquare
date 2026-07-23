import { afterEach, describe, expect, it } from "vitest";
import { pinia } from "../pinia";
import { useGrimoireStore } from "../stores/grimoire";
import { mutationBus } from "./mutation-bus";
import { emitLegacyMutation } from "./legacy-effects";

describe("legacy effect bridge", () => {
  afterEach(() => useGrimoireStore(pinia).$reset());

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
});
