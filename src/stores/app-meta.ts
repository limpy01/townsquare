import { defineStore } from "pinia";
import { version } from "../../package.json";

type AppMetaState = {
  version: string;
  latestVersion: string;
  lastVersion: string;
  floatingNotice: string;
};

export const useAppMetaStore = defineStore("app-meta", {
  state: (): AppMetaState => ({
    version,
    latestVersion: "",
    lastVersion: "",
    floatingNotice: "",
  }),
  actions: {
    setLatestVersion(latestVersion: string) {
      this.latestVersion = latestVersion;
    },
    setLastVersion(lastVersion: string) {
      this.lastVersion = lastVersion;
    },
    setFloatingNotice(floatingNotice: string) {
      this.floatingNotice = floatingNotice;
    },
  },
});
