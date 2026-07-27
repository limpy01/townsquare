import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSessionIdentityStore } from "../stores/session-identity";
import { useVotingStore } from "../stores/voting";
import { useVoteController } from "./use-vote-controller";

describe("vote controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });
  afterEach(() => vi.useRealTimers());

  it("advances locks and stops after every seat has voted", () => {
    const voting = useVotingStore();
    const session = useSessionIdentityStore();
    voting.setNomination([0, 1], { isSecretVote: false, claimedSeat: -1 });
    voting.setVotingSpeed(10);
    const controller = useVoteController({
      voting,
      session,
      getPlayers: () => [{ id: "one" }, { id: "two" }],
      getNomineeTeam: () => "townsfolk",
    });

    controller.start();
    vi.advanceTimersByTime(30);

    expect(voting.lockedVote).toBe(3);
    expect(voting.isVoteInProgress).toBe(false);
    expect(controller.timer.value).toBeNull();
  });

  it("records a completed nomination and clears it through the store boundary", () => {
    const voting = useVotingStore();
    const session = useSessionIdentityStore();
    const players = [
      { id: "one", name: "One", role: { team: "townsfolk" } },
      { id: "two", name: "Two", role: { team: "demon" } },
    ];
    voting.setNomination([0, 1], { isSecretVote: false, claimedSeat: -1 });
    voting.vote([0, 1]);
    voting.lockVote(3);
    const controller = useVoteController({
      voting,
      session,
      getPlayers: () => players,
      getNomineeTeam: () => "demon",
    });

    controller.finish();

    expect(voting.voteHistory).toHaveLength(1);
    expect(voting.voteHistory[0]).toMatchObject({
      nominator: "1. One",
      nominee: "2. Two",
      votes: 1,
    });
    expect(voting.voteSelected).toEqual([false]);
    expect(voting.nomination).toBe(false);
  });
});
