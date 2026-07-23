import { describe, expect, it } from "vitest";
import { pinia } from "../../pinia";
import { useDistributionStore } from "../../stores/distribution";
import { useLegacyOptionsStore } from "../../stores/legacy-options";
import { useReviewStore } from "../../stores/review";
import { useTimerStore } from "../../stores/timer";
import { useVotingStore } from "../../stores/voting";
import { useRoleActivityStore } from "../../stores/role-activity";
import { useProfileStore } from "../../stores/profile";
import { useSessionIdentityStore } from "../../stores/session-identity";
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

  it("delegates role activity updates to the Pinia store", () => {
    const roles = useRoleActivityStore(pinia);
    roles.$reset();

    sessionModule.mutations.setIsRole(sessionModule.state(), {
      role: "wraith",
      property: "active",
      value: true,
    });

    expect(roles.wraith.active).toBe(true);
  });

  it("delegates player profile updates to the Pinia store", () => {
    const profile = useProfileStore(pinia);
    profile.$reset();

    sessionModule.mutations.setPlayerName(sessionModule.state(), "Alice");
    sessionModule.mutations.updatePlayerAvatar(
      sessionModule.state(),
      "alice.webp",
    );

    expect(profile.$state).toEqual({
      playerName: "Alice",
      playerAvatar: "alice.webp",
    });
  });

  it("exposes the Pinia session identity through legacy state accessors", () => {
    const identity = useSessionIdentityStore(pinia);
    identity.$reset();
    const state = sessionModule.state();

    sessionModule.mutations.setSpectator(state, true);
    state.claimedSeat = 2;

    expect(state.isSpectator).toBe(true);
    expect(identity.claimedSeat).toBe(2);
  });
});
