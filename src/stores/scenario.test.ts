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

  it("rejects malformed custom input without replacing the active script", () => {
    const scenario = useScenarioStore();
    const originalRoles = scenario.roles;

    expect(
      scenario.setCustomRoles([{ id: "invalid", name: "Missing team" }]),
    ).toBe(false);
    expect(scenario.roles).toBe(originalRoles);
  });

  it("ignores an edition without a stable identifier", () => {
    const scenario = useScenarioStore();
    const originalEdition = scenario.edition;

    expect(scenario.setEdition({ roles: ["imp"] })).toBeUndefined();
    expect(scenario.edition).toBe(originalEdition);
  });

  it("keeps only role IDs in custom night order lists", () => {
    const scenario = useScenarioStore();

    scenario.setFirstNight(["chef", 1, "imp", null]);
    scenario.setOtherNight(["washerwoman", {}, "poisoner"]);

    expect(scenario.firstNight).toEqual(["chef", "imp"]);
    expect(scenario.otherNight).toEqual(["washerwoman", "poisoner"]);
  });
});
