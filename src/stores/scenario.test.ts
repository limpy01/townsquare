import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useScenarioStore } from "./scenario";

describe("scenario store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("initializes the default edition and its roles", () => {
    const scenario = useScenarioStore();

    expect(scenario.edition?.id).toBe("tb");
    expect(scenario.roles.get("washerwoman")?.id).toBe("washerwoman");
    expect(scenario.fabled.get("bootlegger")?.id).toBe("bootlegger");
  });
});
