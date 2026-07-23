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

  it("updates scenario metadata and night-order state", () => {
    const scenario = useScenarioStore();

    scenario.setSelectedEditions({ tb: true });
    scenario.setStates(["drunk"]);
    scenario.setTeamsNames({ townsfolk: "Town" });
    scenario.setFirstNight(["washerwoman"]);
    scenario.setOtherNight(["imp"]);

    expect(scenario.selectedEditions).toEqual({ tb: true });
    expect(scenario.states).toEqual(["drunk"]);
    expect(scenario.teamsNames).toEqual({ townsfolk: "Town" });
    expect(scenario.firstNight).toEqual(["washerwoman"]);
    expect(scenario.otherNight).toEqual(["imp"]);
  });

  it("normalizes custom roles into the active script", () => {
    const scenario = useScenarioStore();

    scenario.setCustomRoles([
      {
        id: "Custom Role",
        name: "Custom Role",
        ability: "Does a thing.",
        team: "townsfolk",
      },
    ]);

    expect(scenario.roles.get("customrole")).toMatchObject({
      id: "customrole",
      name: "Custom Role",
      team: "townsfolk",
    });
  });
});
