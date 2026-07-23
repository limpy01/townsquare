import type { LegacyAction, LegacyMutation } from "../legacy-vuex";
import { pinia } from "../../pinia";
import { useAudioStore } from "../../stores/audio";
import { useDistributionStore } from "../../stores/distribution";
import { useLegacyOptionsStore } from "../../stores/legacy-options";
import { useReviewStore } from "../../stores/review";
import { useTimerStore } from "../../stores/timer";
import { useVotingStore } from "../../stores/voting";
import { useSessionSettingsStore } from "../../stores/session-settings";
import { useRoleActivityStore } from "../../stores/role-activity";
import { useProfileStore } from "../../stores/profile";
import { useMessageOutboxStore } from "../../stores/message-outbox";
import { useChatStore } from "../../stores/chat";
import { useSessionIdentityStore } from "../../stores/session-identity";

const state = () => {
  const session: Record<string, unknown> = {};
  const identity = useSessionIdentityStore(pinia);
  const fields = {
    sessionId: {
      get: () => identity.sessionId,
      set: (value: unknown) => identity.setSessionId(value as string),
    },
    StId: {
      get: () => identity.stId,
      set: (value: unknown) => identity.setStId(value as string | null),
    },
    stId: {
      get: () => identity.stId,
      set: (value: unknown) => identity.setStId(value as string | null),
    },
    stSecret: {
      get: () => identity.stSecret,
      set: (value: unknown) => identity.setStSecret(value as string),
    },
    isSpectator: {
      get: () => identity.isSpectator,
      set: (value: unknown) => identity.setSpectator(value as boolean),
    },
    playerId: {
      get: () => identity.playerId,
      set: (value: unknown) => identity.setPlayerId(value as string),
    },
    claimedSeat: {
      get: () => identity.claimedSeat,
      set: (value: unknown) => identity.claimSeat(value as number),
    },
  };

  Object.entries(fields).forEach(([field, accessor]) => {
    Object.defineProperty(session, field, {
      enumerable: true,
      get: accessor.get,
      set: accessor.set,
    });
  });

  return session;
};

const actions: Record<string, LegacyAction> = {};

// mutations helper functions
const set =
  (key: string): LegacyMutation =>
  (state, val) => {
    state[key] = val;
  };

const mutations: Record<string, LegacyMutation> = {
  setPlayerId(_state, playerId) {
    useSessionIdentityStore(pinia).setPlayerId(playerId);
  },
  setStId(_state, stId) {
    useSessionIdentityStore(pinia).setStId(stId);
  },
  setStSecret(_state, stSecret) {
    useSessionIdentityStore(pinia).setStSecret(stSecret);
  },
  setSpectator(_state, isSpectator) {
    useSessionIdentityStore(pinia).setSpectator(isSpectator);
  },
  setPlayerVotes(_state, playerVotes) {
    useVotingStore(pinia).setPlayerVotes(playerVotes);
  },
  setVotingSpeed(_state, votingSpeed) {
    useVotingStore(pinia).setVotingSpeed(votingSpeed);
  },
  setVoteInProgress(_state, isVoteInProgress) {
    useVotingStore(pinia).setVoteInProgress(isVoteInProgress);
  },
  setMarkedPlayer(state, markedPlayer) {
    useVotingStore(pinia).setMarkedPlayer(markedPlayer, {
      isSecretVote: useVotingStore(pinia).isSecretVote,
    });
  },
  setNomination(state, nomination) {
    useVotingStore(pinia).setNomination(nomination, {
      isSecretVote: useVotingStore(pinia).isSecretVote,
      claimedSeat: state.claimedSeat,
    });
  },
  setVoteHistoryAllowed(_state, isVoteHistoryAllowed) {
    useVotingStore(pinia).setVoteHistoryAllowed(isVoteHistoryAllowed);
  },
  setSecretVote(_state, isSecretVote) {
    useVotingStore(pinia).setSecretVote(isSecretVote);
  },
  setBootlegger(_state, bootlegger) {
    useSessionSettingsStore(pinia).setBootlegger(bootlegger);
  },
  setUseOldOrder(_state, useOldOrder) {
    useLegacyOptionsStore(pinia).setUseOldOrder(useOldOrder);
  },
  setUseOldRole(_state, useOldRole) {
    useLegacyOptionsStore(pinia).setUseOldRole(useOldRole);
  },
  setIsReview(_state, isReview) {
    useReviewStore(pinia).setReview(isReview);
  },
  claimSeat(_state, claimedSeat) {
    useSessionIdentityStore(pinia).claimSeat(claimedSeat);
  },
  distributeRoles(_state, active) {
    useDistributionStore(pinia).setRoles(active);
  },
  distributeTypes(_state, active) {
    useDistributionStore(pinia).setTypes(active);
  },
  distributeBluffs(_state, { val }) {
    useDistributionStore(pinia).setBluffs(val);
  },
  distributeGrimoire(_state, { val }) {
    useDistributionStore(pinia).setGrimoire(val);
  },
  setSessionId(state, sessionId) {
    useSessionIdentityStore(pinia).setSessionId(sessionId);
  },
  setPlayerName(_state, playerName) {
    useProfileStore(pinia).setPlayerName(playerName);
  },
  nomination(state, nomination = {}) {
    useVotingStore(pinia).setNomination(nomination, {
      isSecretVote: useVotingStore(pinia).isSecretVote,
      claimedSeat: state.claimedSeat,
    });
  },
  /**
   * Create an entry in the vote history log. Requires current player array because it might change later in the game.
   * Only stores votes that were completed.
   * @param state
   * @param players
   */
  addHistory(state, players) {
    const voting = useVotingStore(pinia);
    const entry = voting.createHistoryEntry(players, {
      isVoteHistoryAllowed: voting.isVoteHistoryAllowed,
      isSpectator: state.isSpectator,
    });
    if (entry) this.commit("session/addVotes", entry);
  },
  addVotes(_state, entry) {
    useVotingStore(pinia).addVotes(entry);
  },
  addVoteSelected(state, payload) {
    const voting = useVotingStore(pinia);
    voting.addVoteSelected(payload, {
      isVoteHistoryAllowed: voting.isVoteHistoryAllowed,
      isSpectator: state.isSpectator,
    });
  },
  setVoteSelected(_state, selection) {
    useVotingStore(pinia).setVoteSelected(selection);
  },
  clearVoteHistory(_state, voteIndexes = null) {
    useVotingStore(pinia).clearVoteHistory(voteIndexes);
  },
  /**
   * Store a vote with and without syncing it to the live session.
   * This is necessary in order to prevent infinite voting loops.
   * @param state
   * @param vote
   */
  vote(_state, vote) {
    useVotingStore(pinia).vote(vote);
  },
  voteSync(_state, vote) {
    useVotingStore(pinia).vote(vote);
  },
  lockVote(_state, lock) {
    useVotingStore(pinia).lockVote(lock);
  },
  createChatHistory(state, playerId) {
    useChatStore(pinia).createHistory(playerId);
  },
  updateChatSent(state, chatContent) {
    if (state.isSpectator && chatContent.sendingPlayerId != state.playerId)
      return;
    this.commit("session/addMessageQueue", {
      type: "direct",
      playerId: chatContent.receivingPlayerId,
      command: "chat",
      params: chatContent,
      id: new Date().getTime(),
    });
  },
  updateChatReceived(state, { message, playerId }) {
    if (state.isSpectator && playerId != state.stId) return;
    useChatStore(pinia).addReceivedMessage({ message, playerId });
  },
  addMessageQueue(_state, { type, playerId, command, params, id }) {
    useMessageOutboxStore(pinia).add({ type, playerId, command, params, id });
  },
  deleteMessageQueue(_state, index) {
    useMessageOutboxStore(pinia).remove(index);
  },
  checkUniqueMessage(_state, feedback) {
    useMessageOutboxStore(pinia).checkUnique(feedback);
  },
  addGroupChat(state, { chatId, players, playerIds, keep }) {
    const chat = useChatStore(pinia);
    if (chat.groups.length >= 20) return;

    if (!!playerIds && !players) {
      players = this.state.players.players.filter((player: any) =>
        playerIds.includes(player.id),
      );
    }

    const groupIndex = chat.groups.findIndex(
      (group: any) => group.id === chatId,
    );
    // 提供id则加入已存在的群聊，否则创建新的群聊
    if (groupIndex !== -1) {
      const group = chat.groups[groupIndex];
      if (!group) return;
      group.players = [...group.players, ...players];
      players.forEach((player: any) => {
        this.commit("players/update", {
          player,
          property: "chatGroup",
          value: chatId,
        });
      });
      return;
    }

    // 最多允许20个群聊（默认名字）
    const pattern = /^群聊(1[0-9]|20|[1-9])$/;
    const names = chat.groups.map((group: any) => group.name);
    const allSuffixes = names
      .filter((name: any) => pattern.test(name))
      .map((name: any) => name.replace(/^群聊/, ""))
      .map(Number);
    const maxIndex = Math.max(...allSuffixes);
    const index = maxIndex + 1;
    let name = "群聊" + index;
    if (index > 20 || names.includes(name)) {
      for (let i = 1; i <= 21; i++) {
        if (!allSuffixes.includes(i)) {
          name = "群聊" + i;
          break;
        }
      }
    }
    // initialise group chats
    chat.groups.push({
      id: chatId,
      name: names.length === 0 ? "群聊1" : name,
      keep: keep === undefined ? false : keep,
      players,
    });
    players.forEach((player: any) => {
      this.commit("players/update", {
        player,
        property: "chatGroup",
        value: chatId,
      });
    });
  },
  removeGroupChat(state, { chatId }) {
    const chat = useChatStore(pinia);
    const index = chat.groups.findIndex((group: any) => group.id === chatId);
    if (index === -1) return;
    const group = chat.groups[index];
    if (!group) return;

    group.players.forEach((player: any) => {
      this.commit("players/update", {
        player,
        property: "chatGroup",
        value: "",
      });
    });
    chat.groups.splice(index, 1);
  },
  removeGroupChatMember(state, { chatId, player, playerId }) {
    const chat = useChatStore(pinia);
    const groupIndex = chat.groups.findIndex(
      (group: any) => group.id === chatId,
    );
    if (groupIndex === -1) return;
    const group = chat.groups[groupIndex];
    if (!group) return;

    if (!!playerId && !player) {
      const playerArray = this.state.players.players.filter(
        (player: any) => playerId === player.id,
      );
      if (playerArray.length == 0) return;
      player = playerArray[0];
    }

    const playerIndex = group.players.findIndex(
      (item: any) => item.id == player.id,
    );
    if (playerIndex === -1) return;
    const groupPlayer = group.players[playerIndex];
    if (!groupPlayer) return;
    this.commit("players/update", {
      player: groupPlayer,
      property: "chatGroup",
      value: "",
    });
    group.players.splice(playerIndex, 1);
  },
  toggleGroupKeep(state, chatId) {
    const chat = useChatStore(pinia);
    const index = chat.groups.findIndex((group: any) => group.id === chatId);
    if (index === -1) return;

    const group = chat.groups[index];
    if (!group) return;
    group.keep = !group.keep;
  },
  setPlayerAvatar() {
    useProfileStore(pinia).resetPlayerAvatar();
  },
  updatePlayerAvatar(_state, playerAvatar) {
    useProfileStore(pinia).updatePlayerAvatar(playerAvatar);
  },
  setIsRole(_state, payload) {
    useRoleActivityStore(pinia).setRole(payload);
  },
  setTimer(_state, timer) {
    useTimerStore(pinia).setTimer(timer);
  },
  startTimer(_state, time) {
    useTimerStore(pinia).startTimer(time);
  },
  stopTimer() {
    useTimerStore(pinia).stopTimer();
  },
  setTalking(state, { seatNum, isTalking }) {
    if (seatNum < 0 || seatNum >= this.state.players.players.length) return;
    if (
      !this.state.players.players[seatNum].id ||
      this.state.players.players[seatNum].id != state.playerId
    )
      return;
    useAudioStore(pinia).setTalking(isTalking);
    this.commit("players/setIsTalking", { seatNum, isTalking });
  },
};

const sessionModule: any = {
  namespaced: true,
  state,
  actions,
  mutations,
};

export default sessionModule;
