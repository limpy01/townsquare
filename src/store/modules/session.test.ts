import { describe, expect, it } from "vitest";
import { pinia } from "../../pinia";
import { useDistributionStore } from "../../stores/distribution";
import { useLegacyOptionsStore } from "../../stores/legacy-options";
import { useReviewStore } from "../../stores/review";
import { useTimerStore } from "../../stores/timer";
import { useVotingStore } from "../../stores/voting";
import sessionModule from "./session";

describe("session Vuex compatibility module", () => {
  it("normalizes persisted session IDs", () => {
    const state = sessionModule.state();

    sessionModule.mutations.setSessionId(state, "Room ID! 123456789");

    expect(state.sessionId).toBe("roomid1234");
  });

  it("ignores vote changes when no nomination is active", () => {
    const state = sessionModule.state();
    const voting = useVotingStore(pinia);
    voting.$reset();
    voting.votes = [false];

    sessionModule.mutations.vote(state, [0, true]);
    expect(voting.votes).toEqual([false]);

    voting.nomination = [0, 1];
    sessionModule.mutations.vote(state, [0, true]);
    expect(voting.votes).toEqual([true]);
  });

  it("accepts the legacy nomination array payload", () => {
    const voting = useVotingStore(pinia);
    voting.$reset();

    sessionModule.mutations.setNomination(sessionModule.state(), [2, 4]);

    expect(voting.nomination).toEqual([2, 4]);
  });

  it("delegates timer commands to the Pinia timer store", () => {
    const timer = useTimerStore(pinia);
    timer.$reset();

    sessionModule.mutations.setTimer(sessionModule.state(), 90);

    expect(timer.seconds).toBe(90);
  });

  it("delegates distribution flags to the Pinia store", () => {
    const distribution = useDistributionStore(pinia);
    distribution.$reset();

    sessionModule.mutations.distributeRoles(sessionModule.state(), true);
    sessionModule.mutations.distributeBluffs(sessionModule.state(), {
      val: true,
    });

    expect(distribution.roles).toBe(true);
    expect(distribution.bluffs).toBe(true);
  });

  it("delegates review mode to the Pinia store", () => {
    const review = useReviewStore(pinia);
    review.$reset();

    sessionModule.mutations.setIsReview(sessionModule.state(), true);

    expect(review.isReview).toBe(true);
  });

  it("delegates old role options to the Pinia store", () => {
    const options = useLegacyOptionsStore(pinia);
    options.$reset();

    sessionModule.mutations.setUseOldOrder(sessionModule.state(), {
      pithag: true,
      professor: false,
    });

    expect(options.useOldOrder.pithag).toBe(true);
  });
});
