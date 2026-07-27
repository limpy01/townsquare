import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDistributionStore } from "./distribution";

describe("distribution store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("tracks each independently highlighted distribution channel", () => {
    const distribution = useDistributionStore();

    distribution.setRoles(true);
    distribution.setTypes(true);
    distribution.setBluffs(true);
    distribution.setGrimoire(true);

    expect(distribution.$state).toEqual({
      roles: true,
      types: true,
      bluffs: true,
      grimoire: true,
    });
  });
});
