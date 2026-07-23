import { describe, expect, it } from "vitest";
import {
  customRoleDefaults,
  getCustomRolesStripped,
  rolesJSONbyId,
} from "./selectors";

describe("store selectors", () => {
  it("indexes bundled roles by ID", () => {
    expect(rolesJSONbyId.get("washerwoman")?.name).toBe("洗衣妇");
  });

  it("compacts official and custom roles for transport", () => {
    const roles = getCustomRolesStripped([
      { id: "washerwoman", isCustom: false },
      { ...customRoleDefaults, id: "test-role", name: "Test", ability: "A" },
    ]);

    expect(roles).toEqual([
      { id: "washerwoman" },
      {
        0: "test-role",
        1: "Test",
        3: "A",
      },
    ]);
  });
});
