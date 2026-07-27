import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useReviewStore } from "./review";

describe("review store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("tracks the storyteller review mode", () => {
    const review = useReviewStore();

    review.setReview(true);
    expect(review.isReview).toBe(true);

    review.setReview(false);
    expect(review.isReview).toBe(false);
  });
});
