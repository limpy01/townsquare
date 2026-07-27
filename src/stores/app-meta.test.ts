import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { version } from "../../package.json";
import { useAppMetaStore } from "./app-meta";

describe("app meta store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("tracks the deployed version, notice, and acknowledged release", () => {
    const appMeta = useAppMetaStore();
    appMeta.setLatestVersion("3.3.2");
    appMeta.setLastVersion("3.3.1");
    appMeta.setFloatingNotice("Maintenance tonight");

    expect(appMeta.version).toBe(version);
    expect(appMeta.latestVersion).toBe("3.3.2");
    expect(appMeta.lastVersion).toBe("3.3.1");
    expect(appMeta.floatingNotice).toBe("Maintenance tonight");
  });
});
