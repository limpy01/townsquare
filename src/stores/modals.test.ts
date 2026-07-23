import { beforeEach, describe, expect, it } from "vitest";
import { pinia } from "../pinia";
import { useModalStore } from "./modals";

describe("modal Pinia store", () => {
  const modals = useModalStore(pinia);

  beforeEach(() => modals.$reset());

  it("keeps at most one modal open and supports closing all modals", () => {
    modals.toggle("reference");
    modals.toggle("nightOrder");

    expect(modals.reference).toBe(false);
    expect(modals.nightOrder).toBe(true);

    modals.toggle();
    expect(Object.values(modals.$state).every((isOpen) => !isOpen)).toBe(true);
  });
});
