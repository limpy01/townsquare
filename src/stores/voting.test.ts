import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useVotingStore } from "./voting";

describe("voting store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("keeps a secret nomination visible only to its claimed seat", () => {
    const voting = useVotingStore();

    voting.setNomination(
      {
        nomination: [0, 1],
        votes: [true, true],
        nominatedPlayer: { role: { team: "townsfolk" } },
      },
      { isSecretVote: true, claimedSeat: 1 },
    );

    expect(voting.votes).toEqual([false, true]);
  });

  it("records and selectively clears completed vote history", () => {
    const voting = useVotingStore();
    voting.nomination = [0, 1];
    voting.lockedVote = 3;
    voting.votes = [true, 2];

    const entry = voting.createHistoryEntry(
      [
        { id: "a", name: "Alice", role: { team: "townsfolk" } },
        { id: "b", name: "Bob", role: { team: "minion" } },
      ],
      { isVoteHistoryAllowed: true, isSpectator: false },
    );

    expect(entry).toMatchObject({ votes: 2, majority: 1, save: true });
    voting.addVotes(entry!);
    voting.addVoteSelected(
      { selected: true },
      { isVoteHistoryAllowed: true, isSpectator: false },
    );
    voting.clearVoteHistory([0]);

    expect(voting.voteHistory).toEqual([]);
    expect(voting.voteSelected).toEqual([]);
  });
});
