import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDrawStore } from "./draw";

describe("draw store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("copies role selections and clears them after drawing", () => {
    const draw = useDrawStore();
    const roles = [{ id: "imp" }];

    draw.setRoles(roles);
    roles.push({ id: "chef" });
    expect(draw.roles).toEqual([{ id: "imp" }]);

    draw.clearRoles();
    expect(draw.roles).toEqual([]);
  });
});
