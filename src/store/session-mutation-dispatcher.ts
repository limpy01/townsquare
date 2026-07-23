export interface SessionOutboundTarget {
  connect(sessionId: unknown): void;
  disconnect(): void;
  claimSeat(payload: unknown): void;
  distributeRoles(): void;
  distributeTypes(): void;
  distributeBluffs(payload: unknown): void;
  distributeGrimoire(payload: unknown): void;
  nomination(payload: unknown): void;
  setVoteInProgress(payload: unknown): void;
  vote(payload: unknown): void;
  lockVote(): void;
  setVotingSpeed(payload: unknown): void;
  setVoteHistoryAllowed(): void;
  setIsNight(): void;
  sendEdition(): void;
  sendStates(): void;
  sendTeamsNames(): void;
  sendFirstNight(): void;
  sendOtherNight(): void;
  sendFabled(): void;
  setMarked(payload: unknown): void;
  swapPlayer(payload: unknown): void;
  movePlayer(payload: unknown): void;
  removePlayer(payload: unknown): void;
  sendGamestate(playerId: unknown, isLightweight: unknown): void;
  sendPlayer(payload: unknown): void;
  sendPlayerPronouns(payload: unknown): void;
  emptyPlayer(payload: unknown): void;
  sendAddGroupChat(payload: unknown): void;
  sendRemoveGroupChat(payload: unknown): void;
  sendRemoveGroupChatMember(payload: unknown): void;
  _startSendQueue(): void;
  _stopSendQueue(): void;
  setTimer(payload: unknown): void;
  startTimer(payload: unknown): void;
  stopTimer(payload: unknown): void;
  uploadAvatar(payload: unknown): void;
  setSecretVote(payload: unknown): void;
  setUseOldOrder(payload: unknown): void;
  setUseOldRole(payload: unknown): void;
  setIsReview(payload: unknown): void;
  setTalking(payload: unknown): void;
  setIsRole(payload: unknown): void;
}

export interface SessionMutation {
  type: string;
  payload?: unknown;
}

export interface SessionOutboundState {
  session: {
    sessionId: unknown;
    messageQueue: unknown[];
  };
}

export function dispatchSessionMutation(
  target: SessionOutboundTarget,
  { type, payload }: SessionMutation,
  state: SessionOutboundState,
) {
  switch (type) {
    case "session/setSessionId":
      if (state.session.sessionId) target.connect(state.session.sessionId);
      else target.disconnect();
      break;
    case "session/claimSeat":
      target.claimSeat(payload);
      break;
    case "session/distributeRoles":
      if (payload) target.distributeRoles();
      break;
    case "session/distributeTypes":
      if (payload) target.distributeTypes();
      break;
    case "session/distributeBluffs":
      if (payload) target.distributeBluffs(payload);
      break;
    case "session/distributeGrimoire":
      if (payload) target.distributeGrimoire(payload);
      break;
    case "session/nomination":
    case "session/setNomination":
      target.nomination(payload);
      break;
    case "session/setVoteInProgress":
      target.setVoteInProgress(payload);
      break;
    case "session/voteSync":
      target.vote(payload);
      break;
    case "session/lockVote":
      target.lockVote();
      break;
    case "session/setVotingSpeed":
      target.setVotingSpeed(payload);
      break;
    case "session/setVoteHistoryAllowed":
      target.setVoteHistoryAllowed();
      break;
    case "toggleNight":
      target.setIsNight();
      break;
    case "setEdition":
      target.sendEdition();
      break;
    case "setStates":
      target.sendStates();
      break;
    case "setTeamsNames":
      target.sendTeamsNames();
      break;
    case "setFirstNight":
      target.sendFirstNight();
      break;
    case "setOtherNight":
      target.sendOtherNight();
      break;
    case "players/setFabled":
      target.sendFabled();
      break;
    case "session/setMarkedPlayer":
      target.setMarked(payload);
      break;
    case "players/swap":
      target.swapPlayer(payload);
      break;
    case "players/move":
      target.movePlayer(payload);
      break;
    case "players/remove":
      target.removePlayer(payload);
      break;
    case "players/set":
    case "players/clear":
    case "players/add":
      target.sendGamestate("", true);
      break;
    case "players/update":
      if ((payload as { property?: unknown }).property === "pronouns") {
        target.sendPlayerPronouns(payload);
      } else {
        target.sendPlayer(payload);
      }
      break;
    case "players/empty":
      target.emptyPlayer(payload);
      break;
    case "session/addGroupChat":
      target.sendAddGroupChat(payload);
      break;
    case "session/removeGroupChat":
      target.sendRemoveGroupChat(payload);
      break;
    case "session/removeGroupChatMember":
      target.sendRemoveGroupChatMember(payload);
      break;
    case "session/addMessageQueue":
      target._startSendQueue();
      break;
    case "session/deleteMessageQueue":
      if (state.session.messageQueue.length <= 0) target._stopSendQueue();
      break;
    case "session/setTimer":
      target.setTimer(payload);
      break;
    case "session/startTimer":
      target.startTimer(payload);
      break;
    case "session/stopTimer":
      target.stopTimer(payload);
      break;
    case "session/setPlayerAvatar":
      target.uploadAvatar(payload);
      break;
    case "session/setSecretVote":
      target.setSecretVote(payload);
      break;
    case "session/setUseOldOrder":
      target.setUseOldOrder(payload);
      break;
    case "session/setUseOldRole":
      target.setUseOldRole(payload);
      break;
    case "session/setIsReview":
      target.setIsReview(payload);
      if (payload) target.distributeGrimoire({ all: true });
      break;
    case "session/setTalking":
      target.setTalking(payload);
      break;
    case "session/setIsRole":
      target.setIsRole(payload);
      break;
  }
}
