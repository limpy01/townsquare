import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useLegacyOptionsStore } from "./legacy-options";

describe("legacy options store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("copies persisted old role and night order choices", () => {
    const options = useLegacyOptionsStore();
    const order = { pithag: true, professor: false };
    const roles = {
      balloonist: true,
      acrobat: false,
      lilmonsta: false,
      alchemist: false,
      lycanthrope: false,
    };

    options.setUseOldOrder(order);
    options.setUseOldRole(roles);
    order.pithag = false;
    roles.balloonist = false;

    expect(options.useOldOrder.pithag).toBe(true);
    expect(options.useOldRole.balloonist).toBe(true);
  });
});
