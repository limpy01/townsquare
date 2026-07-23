import { describe, expect, it, vi } from "vitest";
import { createMutationBus } from "./mutation-bus";

describe("mutation bus", () => {
  it("delivers mutations and can unsubscribe listeners", () => {
    const bus = createMutationBus<{ active: boolean }>();
    const subscriber = vi.fn();
    const unsubscribe = bus.subscribe(subscriber);

    bus.emit({ type: "toggleNight", payload: true }, { active: true });
    unsubscribe();
    bus.emit({ type: "toggleNight", payload: false }, { active: false });

    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledWith(
      { type: "toggleNight", payload: true },
      { active: true },
    );
  });
});
