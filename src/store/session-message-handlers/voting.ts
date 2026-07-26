import type { SessionInboundTarget } from "../session-message-target";

export function handleVotingMessage(
  target: SessionInboundTarget,
  command: string | undefined,
  params: unknown,
): boolean {
  switch (command) {
    case "nomination":
      if (!target._isSpectator) return true;
      target.applyIncomingNomination(params);
      return true;
    case "marked":
      if (target._isSpectator) target.applyIncomingMarkedPlayer(params);
      return true;
    case "isNight":
      if (target._isSpectator) target.applyIncomingNight(params);
      return true;
    case "isVoteHistoryAllowed":
      if (!target._isSpectator) return true;
      target.applyIncomingVoteHistoryAllowed(params);
      target.clearIncomingVoteHistory();
      return true;
    case "votingSpeed":
      if (target._isSpectator) target.applyIncomingVotingSpeed(params);
      return true;
    case "clearVoteHistory":
      if (target._isSpectator) target.clearIncomingVoteHistory();
      return true;
    case "isVoteInProgress":
      if (target._isSpectator) target.applyIncomingVoteInProgress(params);
      return true;
    case "vote":
      target._handleVote(params);
      return true;
    case "lock":
      target._handleLock(params);
      return true;
    case "secretVote":
      target._handleSecretVote(params);
      return true;
    case "setTimer":
      target._handleSetTimer(params);
      return true;
    case "startTimer":
      target._handleStartTimer(params);
      return true;
    case "stopTimer":
      target._handleStopTimer();
      return true;
    case "bootlegger":
      target._handleSetBootlegger(params);
      return true;
    case "useOldOrder":
      target._handleSetUseOldOrder(params);
      return true;
    case "useOldRole":
      target._handleSetUseOldRole(params);
      return true;
    case "isReview":
      target._handleSetIsReview(params);
      return true;
    default:
      return false;
  }
}
