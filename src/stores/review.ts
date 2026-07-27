import { defineStore } from "pinia";

export const useReviewStore = defineStore("review", {
  state: () => ({
    isReview: false,
  }),
  actions: {
    setReview(isReview: boolean) {
      this.isReview = isReview;
    },
  },
});
