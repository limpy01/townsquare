import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useRoleActivityStore } from "./role-activity";

describe("role activity store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("only accepts storyteller-authorized wraith usage updates", () => {
    const roles = useRoleActivityStore();

    roles.setRole({ role: "wraith", property: "using", value: true });
    expect(roles.wraith.using).toBe(false);

    roles.setRole({
      role: "wraith",
      property: "using",
      value: true,
      st: true,
    });
    expect(roles.wraith.using).toBe(true);
  });
});
