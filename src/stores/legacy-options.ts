import { defineStore } from "pinia";

export type UseOldOrder = {
  pithag: boolean;
  professor: boolean;
};

export type UseOldRole = {
  balloonist: boolean;
  acrobat: boolean;
  lilmonsta: boolean;
  alchemist: boolean;
  lycanthrope: boolean;
};

export const useLegacyOptionsStore = defineStore("legacy-options", {
  state: () => ({
    useOldOrder: {
      pithag: false,
      professor: false,
    } as UseOldOrder,
    useOldRole: {
      balloonist: false,
      acrobat: false,
      lilmonsta: false,
      alchemist: false,
      lycanthrope: false,
    } as UseOldRole,
  }),
  actions: {
    setUseOldOrder(useOldOrder: UseOldOrder) {
      this.useOldOrder = { ...useOldOrder };
    },
    setUseOldRole(useOldRole: UseOldRole) {
      this.useOldRole = { ...useOldRole };
    },
  },
});
