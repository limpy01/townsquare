import { defineStore } from "pinia";

export type Vote = boolean | number | undefined;
export type Nomination = [number, number] | false;

export interface VoteHistoryEntry {
  timestamp: Date;
  nominator: string;
  nominee: string;
  type: string;
  mode: string;
  votes: number;
  majority: number;
  votedPlayers: string[];
  save?: boolean;
}

type VotingPlayer = {
  id?: string;
  name?: string;
  isDead?: boolean;
  role?: { team?: string };
};

type VotingContext = {
  isSecretVote: boolean;
  claimedSeat: number;
  isSpectator: boolean;
  isVoteHistoryAllowed: boolean;
};

type NominationUpdate = {
  nomination?: Nomination;
  votes?: Vote[];
  votingSpeed?: number;
  lockedVote?: number;
  isVoteInProgress?: boolean;
  nominatedPlayer?: VotingPlayer | null;
};

type NominationPayload = NominationUpdate | Nomination | undefined;

export const useVotingStore = defineStore("voting", {
  state: () => ({
    nomination: false as Nomination,
    playerVotes: 1,
    votes: [] as Vote[],
    lockedVote: 0,
    votingSpeed: 500,
    isVoteInProgress: false,
    isSecretVote: false,
    voteHistory: [] as VoteHistoryEntry[],
    voteSelected: [] as boolean[],
    markedPlayer: -1,
    isVoteHistoryAllowed: true,
  }),
  actions: {
    setPlayerVotes(playerVotes: number) {
      this.playerVotes = playerVotes;
    },
    setVotingSpeed(votingSpeed: number) {
      this.votingSpeed = votingSpeed;
    },
    setVoteInProgress(isVoteInProgress: boolean) {
      this.isVoteInProgress = isVoteInProgress;
    },
    setSecretVote(isSecretVote: boolean) {
      this.isSecretVote = isSecretVote;
    },
    setVoteHistoryAllowed(isVoteHistoryAllowed: boolean) {
      this.isVoteHistoryAllowed = isVoteHistoryAllowed;
    },
    setMarkedPlayer(
      markedPlayer: number | { val?: number; force?: boolean },
      { isSecretVote }: Pick<VotingContext, "isSecretVote">,
    ) {
      const { val, force } =
        typeof markedPlayer === "number" ? { val: markedPlayer } : markedPlayer;
      if (!force && isSecretVote && (val ?? -1) >= 0) return;
      this.markedPlayer = val ?? -1;
    },
    setNomination(
      payload: NominationPayload,
      {
        isSecretVote,
        claimedSeat,
      }: Pick<VotingContext, "isSecretVote" | "claimedSeat">,
    ) {
      const {
        nomination,
        votes,
        votingSpeed,
        lockedVote,
        isVoteInProgress,
        nominatedPlayer = null,
      }: NominationUpdate = Array.isArray(payload)
        ? { nomination: payload }
        : payload || {};
      this.nomination = nomination || false;
      const updatedVotes = votes || [];
      if (
        nomination &&
        nominatedPlayer &&
        isSecretVote &&
        nominatedPlayer.role?.team !== "traveler"
      ) {
        for (let index = 0; index < updatedVotes.length; index++) {
          if (index !== claimedSeat) updatedVotes[index] = false;
        }
      }
      this.votes = updatedVotes;
      this.votingSpeed = votingSpeed || this.votingSpeed;
      this.lockedVote = lockedVote || 0;
      this.isVoteInProgress = isVoteInProgress || false;
    },
    vote([index, vote]: [number, Vote]) {
      if (!this.nomination) return;
      this.votes = [...this.votes];
      this.votes[index] = vote === undefined ? 0 : vote;
    },
    lockVote(lock?: number) {
      this.lockedVote = lock === undefined ? this.lockedVote + 1 : lock;
    },
    createHistoryEntry(
      players: VotingPlayer[],
      {
        isVoteHistoryAllowed,
        isSpectator,
      }: Pick<VotingContext, "isVoteHistoryAllowed" | "isSpectator">,
    ): VoteHistoryEntry | null {
      if (!isVoteHistoryAllowed && isSpectator) return null;
      if (!this.nomination || this.lockedVote <= players.length) return null;

      const [nominatorIndex, nomineeIndex] = this.nomination;
      const nominator = players[nominatorIndex];
      const nominee = players[nomineeIndex];
      if (!nominator || !nominee) return null;
      const isExile = nominee.role?.team === "traveler";
      const votedPlayers = players
        .map((player, index) => ({ player, index, vote: this.votes[index] }))
        .filter(({ vote }) => !!vote);

      return {
        timestamp: new Date(),
        nominator: `${nominatorIndex + 1}. ${
          nominator.id ? nominator.name : ""
        }`,
        nominee: `${nomineeIndex + 1}. ${nominee.id ? nominee.name : ""}`,
        type: isExile ? "流放" : "处决",
        mode: this.isSecretVote ? "闭眼" : "睁眼",
        votes: this.votes
          .filter((vote): vote is number => typeof vote === "number")
          .reduce((sum, vote) => sum + vote, 0),
        majority: Math.ceil(
          players.filter((player) => !player.isDead || isExile).length / 2,
        ),
        votedPlayers: votedPlayers.map(
          ({ player, index, vote }) =>
            `${index + 1}. ${player.name}${
              typeof vote === "number" && vote > 1 ? ` *${vote}票` : ""
            }`,
        ),
        save: true,
      };
    },
    addVotes(entry: VoteHistoryEntry) {
      this.voteHistory.push({
        ...entry,
        timestamp: entry.save ? entry.timestamp : new Date(entry.timestamp),
      });
    },
    addVoteSelected(
      {
        selected,
        players,
        save,
      }: { selected: boolean; players?: unknown[]; save?: boolean },
      {
        isVoteHistoryAllowed,
        isSpectator,
      }: Pick<VotingContext, "isVoteHistoryAllowed" | "isSpectator">,
    ) {
      if (save && !players && !isVoteHistoryAllowed && isSpectator) return;
      this.voteSelected.push(selected);
    },
    setVoteSelected({ index, value }: { index: number; value: boolean }) {
      this.voteSelected[index] = value;
    },
    clearVoteHistory(voteIndexes: number[] | null = null) {
      if (voteIndexes == null || voteIndexes.length === 0) {
        this.voteHistory = [];
        this.voteSelected = [];
        return;
      }
      this.voteHistory = this.voteHistory.filter(
        (_vote, index) => !voteIndexes.includes(index),
      );
      this.voteSelected = this.voteSelected.filter(
        (_selected, index) => !voteIndexes.includes(index),
      );
    },
  },
});
