import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSessionSettingsStore } from "./session-settings";

describe("session settings store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("stores the custom bootlegger description", () => {
    const settings = useSessionSettingsStore();

    settings.setBootlegger("自定义规则");

    expect(settings.bootlegger).toBe("自定义规则");
  });
});
