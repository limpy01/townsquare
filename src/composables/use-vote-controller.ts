import { ref } from "vue";
import { emitGameEvent } from "../store/game-events";
import type { useSessionIdentityStore } from "../stores/session-identity";
import type { useVotingStore } from "../stores/voting";

type VotePlayer = {
  id?: string;
  name?: string;
  isDead?: boolean;
  isVoteless?: boolean;
  role?: { team?: string };
};

type VoteControllerOptions = {
  voting: ReturnType<typeof useVotingStore>;
  session: ReturnType<typeof useSessionIdentityStore>;
  getPlayers(): VotePlayer[];
  getNomineeTeam(): string | undefined;
};

export function useVoteController({
  voting,
  session,
  getPlayers,
  getNomineeTeam,
}: VoteControllerOptions) {
  const timer = ref<ReturnType<typeof setInterval> | null>(null);
  const clearTimer = () => {
    if (timer.value) clearInterval(timer.value);
    timer.value = null;
  };
  const setInProgress = (value: boolean) => {
    voting.setVoteInProgress(value);
    emitGameEvent("session/setVoteInProgress", value);
  };
  const lock = (value?: number) => {
    voting.lockVote(value);
    emitGameEvent("session/lockVote", value);
  };
  const sync = (payload: [number, boolean | number]) => {
    voting.vote(payload);
    emitGameEvent("session/voteSync", payload);
  };
  const advance = () => {
    lock();
    if (voting.lockedVote > getPlayers().length) {
      clearTimer();
      setInProgress(false);
    }
  };
  const start = () => {
    lock(1);
    setInProgress(true);
    clearTimer();
    timer.value = setInterval(advance, voting.votingSpeed);
  };
  const countdown = () => {
    lock(0);
    setInProgress(true);
    timer.value = setInterval(start, 4000);
  };
  const startImmediate = () => {
    const speed = voting.votingSpeed;
    voting.setVotingSpeed(0);
    emitGameEvent("session/setVotingSpeed", 0);
    start();
    voting.setVotingSpeed(speed);
    emitGameEvent("session/setVotingSpeed", speed);
  };
  const pause = () => {
    if (timer.value) clearTimer();
    else timer.value = setInterval(advance, voting.votingSpeed);
  };
  const stop = () => {
    clearTimer();
    setInProgress(false);
    lock(0);
  };
  const finish = () => {
    clearTimer();
    const players = getPlayers();
    const entry = voting.createHistoryEntry(players, {
      isVoteHistoryAllowed: voting.isVoteHistoryAllowed,
      isSpectator: session.isSpectator,
    });
    if (entry) {
      voting.addVotes(entry);
      emitGameEvent("session/addVotes", entry);
    }
    const selection = { selected: false, players, save: true };
    voting.addVoteSelected(selection, {
      isVoteHistoryAllowed: voting.isVoteHistoryAllowed,
      isSpectator: session.isSpectator,
    });
    emitGameEvent("session/addVoteSelected", selection);
    voting.setNomination(undefined, {
      isSecretVote: voting.isSecretVote,
      claimedSeat: session.claimedSeat,
    });
    emitGameEvent("session/nomination");
  };
  const cast = (allowed: boolean, vote: boolean | number) => {
    if (!allowed) return;
    const players = getPlayers();
    const index = players.findIndex((player) => player.id === session.playerId);
    const limit = getNomineeTeam() === "traveler" ? 1 : voting.playerVotes;
    if (index < 0) return;
    const value =
      typeof vote === "number"
        ? Math.max(Math.min(vote + Number(voting.votes[index]), limit), 0)
        : vote
        ? limit
        : 0;
    sync([index, value]);
  };
  const setMarked = (value: number) => {
    const payload = { val: value, force: true };
    voting.setMarkedPlayer(payload, { isSecretVote: voting.isSecretVote });
    emitGameEvent("session/setMarkedPlayer", payload);
  };
  return {
    timer,
    clearTimer,
    countdown,
    start,
    startImmediate,
    pause,
    stop,
    finish,
    cast,
    sync,
    setMarked,
  };
}
