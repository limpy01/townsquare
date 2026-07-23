import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGrimoireStore } from "./grimoire";

describe("grimoire store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("tracks game display settings", () => {
    const grimoire = useGrimoireStore();
    grimoire.toggle("isNight");
    grimoire.set("zoom", 2);

    expect(grimoire.isNight).toBe(true);
    expect(grimoire.zoom).toBe(2);
  });
});
