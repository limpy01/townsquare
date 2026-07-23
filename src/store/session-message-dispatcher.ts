import type { LegacyFeedback } from "@townsquare/contracts/legacy-envelope";

type LegacyStore = {
  commit(type: string, payload?: any): void;
  state: any;
};

export interface SessionInboundTarget {
  readonly _isSpectator: boolean;
  readonly _store: LegacyStore;
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

export function dispatchSessionInboundMessage(
  target: SessionInboundTarget,
  command: string | undefined,
  params: unknown,
  feedback: LegacyFeedback | undefined,
) {
  switch (command) {
    case "alertPopup":
      target._alertPopup(params);
      break;
    case "allowHost":
      target._handleAllowHost(params);
      break;
    case "allowJoin":
      target._handleAllowJoin(params);
      break;
    case "getGamestate":
      target.sendGamestate(params);
      break;
    case "getStId":
      target.sendStId(params);
      break;
    case "edition":
      target._updateEdition(params);
      break;
    case "states":
      target._updateStates(params);
      break;
    case "teamsNames":
      target._updateTeamsNames(params);
      break;
    case "firstNight":
      target._updateFirstNight(params);
      break;
    case "otherNight":
      target._updateOtherNight(params);
      break;
    case "fabled":
      target._updateFabled(params);
      break;
    case "syncPlayersStatus":
      target._handleSyncPlayerStatus(params);
      break;
    case "gs":
      target._updateGamestate(params);
      break;
    case "stId":
      target._updateStId(params);
      break;
    case "player":
      target._updatePlayer(params);
      break;
    case "bluff":
      target._updateBluff(params);
      break;
    case "grimoire":
      target._updateGrimoire(params);
      break;
    case "claim":
      target._updateSeat(params);
      target._createChatHistory(params);
      break;
    case "leaveSeat":
      target._updateLeaveSeat();
      break;
    case "ping":
      target._handlePing(params);
      break;
    case "pong":
      target._handlePong(params);
      break;
    case "feedback":
      target._deleteFromQueue(params);
      break;
    case "nomination":
      if (!target._isSpectator) return;
      if (!params) {
        target._store.commit(
          "session/addHistory",
          target._store.state.players.players,
        );
        target._store.commit("session/addVoteSelected", {
          selected: false,
          players: target._store.state.players.players,
          save: true,
        });
      }
      target._store.commit("session/nomination", { nomination: params });
      break;
    case "swap":
      if (target._isSpectator) target._store.commit("players/swap", params);
      break;
    case "move":
      if (target._isSpectator) target._store.commit("players/move", params);
      break;
    case "remove":
      if (target._isSpectator) target._store.commit("players/remove", params);
      break;
    case "marked":
      if (target._isSpectator)
        target._store.commit("session/setMarkedPlayer", params);
      break;
    case "isNight":
      if (target._isSpectator) target._store.commit("toggleNight", params);
      break;
    case "isVoteHistoryAllowed":
      if (!target._isSpectator) return;
      target._store.commit("session/setVoteHistoryAllowed", params);
      target._store.commit("session/clearVoteHistory");
      break;
    case "votingSpeed":
      if (target._isSpectator)
        target._store.commit("session/setVotingSpeed", params);
      break;
    case "clearVoteHistory":
      if (target._isSpectator) target._store.commit("session/clearVoteHistory");
      break;
    case "isVoteInProgress":
      if (target._isSpectator)
        target._store.commit("session/setVoteInProgress", params);
      break;
    case "vote":
      target._handleVote(params);
      break;
    case "lock":
      target._handleLock(params);
      break;
    case "bye":
      target._handleBye(params);
      break;
    case "pronouns":
      target._updatePlayerPronouns(params);
      break;
    case "isRole":
      target._updateIsRole(params);
      break;
    case "usingRole":
      target._updateUsingRole(params);
      break;
    case "chat":
      target._handleChat(params, feedback);
      break;
    case "addGroupChat":
      target._handleAddGroupChat(params, feedback);
      break;
    case "removeGroupChat":
      target._handleRemoveGroupChat(feedback);
      break;
    case "removeGroupChatMember":
      target._handleRemoveGroupChatMember(params, feedback);
      break;
    case "setTimer":
      target._handleSetTimer(params);
      break;
    case "startTimer":
      target._handleStartTimer(params);
      break;
    case "stopTimer":
      target._handleStopTimer();
      break;
    case "avatarReceived":
      target._avatarReceived(params);
      break;
    case "secretVote":
      target._handleSecretVote(params);
      break;
    case "bootlegger":
      target._handleSetBootlegger(params);
      break;
    case "useOldOrder":
      target._handleSetUseOldOrder(params);
      break;
    case "useOldRole":
      target._handleSetUseOldRole(params);
      break;
    case "isReview":
      target._handleSetIsReview(params);
      break;
    case "setTalking":
      target._handleSetTalking(params);
      break;
  }
}
