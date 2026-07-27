import type { LegacyFeedback } from "@townsquare/contracts/legacy-envelope";

export interface SessionInboundTarget {
  readonly _isSpectator: boolean;
  applyIncomingPlayerSwap(params: unknown): void;
  applyIncomingPlayerMove(params: unknown): void;
  applyIncomingPlayerRemove(params: unknown): void;
  applyIncomingNomination(params: unknown): void;
  applyIncomingMarkedPlayer(params: unknown): void;
  applyIncomingNight(params: unknown): void;
  applyIncomingVoteHistoryAllowed(params: unknown): void;
  applyIncomingVotingSpeed(params: unknown): void;
  applyIncomingVoteInProgress(params: unknown): void;
  clearIncomingVoteHistory(): void;
  _alertPopup(params: unknown): void;
  _handleAllowHost(params: unknown): void;
  _handleAllowJoin(params: unknown): void;
  sendGamestate(params: unknown): void;
  sendStId(params: unknown): void;
  _updateEdition(params: unknown): void;
  _updateStates(params: unknown): void;
  _updateTeamsNames(params: unknown): void;
  _updateFirstNight(params: unknown): void;
  _updateOtherNight(params: unknown): void;
  _updateFabled(params: unknown): void;
  _handleSyncPlayerStatus(params: unknown): void;
  _updateGamestate(params: unknown): void;
  _updateStId(params: unknown): void;
  _updatePlayer(params: unknown): void;
  _updateBluff(params: unknown): void;
  _updateGrimoire(params: unknown): void;
  _updateSeat(params: unknown): void;
  _createChatHistory(params: unknown): void;
  _updateLeaveSeat(): void;
  _handlePing(params: unknown): void;
  _handlePong(params: unknown): void;
  _deleteFromQueue(params: unknown): void;
  _handleVote(params: unknown): void;
  _handleLock(params: unknown): void;
  _handleBye(params: unknown): void;
  _updatePlayerPronouns(params: unknown): void;
  _updateIsRole(params: unknown): void;
  _updateUsingRole(params: unknown): void;
  _handleChat(params: unknown, feedback: LegacyFeedback | undefined): void;
  _handleAddGroupChat(
    params: unknown,
    feedback: LegacyFeedback | undefined,
  ): void;
  _handleRemoveGroupChat(feedback: LegacyFeedback | undefined): void;
  _handleRemoveGroupChatMember(
    params: unknown,
    feedback: LegacyFeedback | undefined,
  ): void;
  _handleSetTimer(params: unknown): void;
  _handleStartTimer(params: unknown): void;
  _handleStopTimer(): void;
  _avatarReceived(params: unknown): void;
  _handleSecretVote(params: unknown): void;
  _handleSetBootlegger(params: unknown): void;
  _handleSetUseOldOrder(params: unknown): void;
  _handleSetUseOldRole(params: unknown): void;
  _handleSetIsReview(params: unknown): void;
  _handleSetTalking(params: unknown): void;
}
