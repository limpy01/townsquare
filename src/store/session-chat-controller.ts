import type {
  LegacyChatPayload,
  LegacySessionStatusPayload,
} from "@townsquare/contracts/legacy-client-command";
import type { LegacyFeedback } from "@townsquare/contracts/legacy-envelope";
import { pinia } from "../pinia";
import { useChatStore } from "../stores/chat";
import { useMessageOutboxStore } from "../stores/message-outbox";
import { usePlayersStore } from "../stores/players";
import { useRoleActivityStore } from "../stores/role-activity";
import { useSessionIdentityStore } from "../stores/session-identity";
import { useVotingStore } from "../stores/voting";
import { isAddGroupChatPayload } from "./session-transport-guards";

type ChatPlayer = { id: string; name?: string };

type ChatQueuePayload = {
  message: string;
  sendingPlayerId: string;
  receivingPlayerId: string;
};

type ChatControllerOptions = {
  isSpectator: () => boolean;
  request: (
    command: string,
    playerId: string,
    params?: unknown,
    feedback?: LegacyFeedback,
  ) => void;
  queueChat: (payload: ChatQueuePayload) => void;
  addGroupChat: (payload: { chatId: string; players: ChatPlayer[] }) => void;
  removeGroupChat: (payload: { chatId: string }) => void;
  removeGroupChatMember: (payload: {
    chatId: string;
    player: ChatPlayer;
  }) => void;
};

export class SessionChatController {
  private readonly _isSpectator: () => boolean;
  private readonly _request: ChatControllerOptions["request"];
  private readonly _queueChat: ChatControllerOptions["queueChat"];
  private readonly _addGroupChat: ChatControllerOptions["addGroupChat"];
  private readonly _removeGroupChat: ChatControllerOptions["removeGroupChat"];
  private readonly _removeGroupChatMember: ChatControllerOptions["removeGroupChatMember"];
  private readonly _chat = useChatStore(pinia);
  private readonly _outbox = useMessageOutboxStore(pinia);
  private readonly _gamePlayers = usePlayersStore(pinia);
  private readonly _roles = useRoleActivityStore(pinia);
  private readonly _identity = useSessionIdentityStore(pinia);
  private readonly _voting = useVotingStore(pinia);

  constructor(options: ChatControllerOptions) {
    this._isSpectator = options.isSpectator;
    this._request = options.request;
    this._queueChat = options.queueChat;
    this._addGroupChat = options.addGroupChat;
    this._removeGroupChat = options.removeGroupChat;
    this._removeGroupChatMember = options.removeGroupChatMember;
  }

  sendAddGroupChat(payload: unknown) {
    if (this._isSpectator()) return;
    if (!isAddGroupChatPayload(payload)) return;
    const { chatId, players } = payload;

    const group = this._chat.groups.find((group) => group.id === chatId);
    if (!group) return;
    const allPlayersId = group.players.map((player) => player.id);
    const newPlayersId = players.map((player) => player.id);
    const oldPlayersId = allPlayersId.filter(
      (id) => !newPlayersId.includes(id),
    );

    newPlayersId.forEach((playerId) => {
      this._outbox.add({
        type: "direct",
        playerId,
        command: "addGroupChat",
        params: allPlayersId,
        id: new Date().getTime(),
      });
    });
    oldPlayersId.forEach((playerId) => {
      this._outbox.add({
        type: "direct",
        playerId,
        command: "addGroupChat",
        params: newPlayersId,
        id: new Date().getTime(),
      });
    });
  }

  /**
   * Remove a group chat. ST only
   * @param playerIds all ids for them to remove group chat.
   */
  sendRemoveGroupChat({ playerIds }: { playerIds?: string[] }) {
    if (this._isSpectator()) return;
    if (!playerIds) return;

    playerIds.forEach((id) => {
      this._outbox.add({
        type: "direct",
        playerId: id,
        command: "removeGroupChat",
        params: undefined,
        id: new Date().getTime(),
      });
    });
  }

  /**
   * Remove members from a group chat. ST only
   * @param chatId id of the chat group
   * @param player player within the chat group
   */
  sendRemoveGroupChatMember({
    chatId,
    player,
  }: {
    chatId: string;
    player: ChatPlayer;
  }) {
    if (this._isSpectator()) return;

    this._outbox.add({
      type: "direct",
      playerId: player.id,
      command: "removeGroupChat",
      params: undefined,
      id: new Date().getTime(),
    });

    const index = this._chat.groups.findIndex((group) => group.id === chatId);
    if (index === -1) return;
    const group = this._chat.groups[index];
    if (!group) return;
    group.players.forEach((member) => {
      if (member.id === player.id) return;
      this._outbox.add({
        type: "direct",
        playerId: member.id,
        command: "removeGroupChatMember",
        params: player.id,
        id: new Date().getTime(),
      });
    });
  }

  /**
   * Update group chat.
   * @param payload
   */
  _handleChat(
    { message, sendingPlayerId, receivingPlayerId }: LegacyChatPayload,
    feedback: LegacyFeedback | null | undefined,
  ): void {
    if (feedback) {
      this._request("deleteMessage", this._identity.playerId, [
        "direct",
        feedback,
      ]);
      if (!this._outbox.checkUnique(String(feedback))) return;
    }
    if (this._isSpectator() && receivingPlayerId != this._identity.playerId)
      return;
    this._chat.addReceivedMessage({
      message,
      playerId: sendingPlayerId,
    });
    const num = 1;
    if (!this._isSpectator()) {
      this._gamePlayers.setPlayerMessage({
        playerId: sendingPlayerId,
        num,
      });
    } else {
      useChatStore(pinia).addStorytellerUnread(num);
    }

    if (this._isSpectator()) return;

    const players = this._gamePlayers.players;
    const sendingPlayer = players.find(
      (player) => player.id === sendingPlayerId,
    );
    if (!sendingPlayer) return;
    const chatId = sendingPlayer.chatGroup;

    const wraiths = players.filter(
      (player) =>
        player.isWraith &&
        player.isUsingWraith &&
        player.isAllowRole &&
        !!player.id,
    );
    const sendingPlayerIndex = players.findIndex(
      (player) => player.id === sendingPlayerId,
    );
    const wraithMessage = `[亡魂][（${sendingPlayerIndex + 1}号）${message}]`;
    wraiths.forEach((player) => {
      if (
        !(
          player.id === sendingPlayerId ||
          (player.chatGroup && player.chatGroup === chatId)
        )
      )
        this._queueChat({
          message: wraithMessage,
          sendingPlayerId: this._identity.playerId,
          receivingPlayerId: player.id,
        });
    });
    // 处理暴露
    const wraith = this._roles.wraith;
    if (!wraith) return;
    const prob = wraith.prob;
    const rand = Math.random();
    if (rand < prob && wraiths.length > 0) {
      const randIndex = Math.floor(Math.random() * wraiths.length);
      const wraithSpotted = wraiths[randIndex];
      if (!wraithSpotted) return;
      const indexSpotted = players.findIndex(
        (player) => player.id === wraithSpotted.id,
      );
      const spottedPlayer = players[indexSpotted];
      if (!spottedPlayer) return;
      const spottedMessage = `[亡魂][亡魂是（${indexSpotted + 1}号）${
        spottedPlayer.name
      }]`;
      this._queueChat({
        message: spottedMessage,
        sendingPlayerId: this._identity.playerId,
        receivingPlayerId: sendingPlayerId,
      });
      const indexExposed = players.findIndex(
        (player) => player.id === sendingPlayerId,
      );
      const exposedMessage = `[亡魂][你已被${indexExposed + 1}号发现！！]`;
      this._queueChat({
        message: exposedMessage,
        sendingPlayerId: this._identity.playerId,
        receivingPlayerId: wraithSpotted.id,
      });
    }

    if (chatId === "") return;

    const groupChats = this._chat.groups;
    if (groupChats.length === 0) return;

    const group = groupChats.find((group) => group.id === chatId);
    if (!group) return;
    const sendPlayers = group.players
      .map((player) => player.id)
      .filter((id) => id != sendingPlayerId);
    sendPlayers.forEach((id) => {
      this._queueChat({
        message,
        sendingPlayerId: this._identity.playerId,
        receivingPlayerId: id,
      });
    });
  }

  /**
   * Create a chat group or add new members
   * @param playerIds list of ids to add to the group chat.
   */
  _handleAddGroupChat(
    playerIds: string[],
    feedback: LegacyFeedback | null = false,
  ): void {
    if (feedback) {
      this._request("deleteMessage", this._identity.playerId, [
        "direct",
        feedback,
      ]);
      if (!this._outbox.checkUnique(String(feedback))) return;
    }
    if (!this._isSpectator()) return;

    const groupChats = this._chat.groups;
    const names = this._gamePlayers.players
      .filter((player) => playerIds.includes(player.id))
      .map((player) => {
        return {
          index: this._gamePlayers.players.findIndex(
            (player2) => player2.id === player.id,
          ),
          name: player.name,
        };
      });
    const sendingPlayerId =
      typeof this._identity.stId === "string" ? this._identity.stId : "";
    const receivingPlayerId = this._identity.playerId;

    if (groupChats.length === 0) {
      let message = "[你已加入群聊！]";
      this._handleChat({ message, sendingPlayerId, receivingPlayerId }, null);

      message = "[群聊中有";
      for (let i = 0; i < names.length; i++) {
        const player = names[i];
        if (!player) continue;
        message += `（${player.index + 1}号）${player.name}`;
        if (i < names.length - 1) message += "、";
      }
      message += "]";
      this._handleChat({ message, sendingPlayerId, receivingPlayerId }, null);
    } else {
      let message = "[";
      for (let i = 0; i < names.length; i++) {
        const player = names[i];
        if (!player) continue;
        message += `（${player.index + 1}号）${player.name}`;
        if (i < names.length - 1) message += "、";
      }
      message += "加入群聊！]";
      this._handleChat({ message, sendingPlayerId, receivingPlayerId }, null);
    }

    const chatId =
      groupChats.length === 0
        ? Math.random().toString(36).substr(2)
        : groupChats[0]?.id ?? "";
    const players = this._gamePlayers.players.filter((player) => {
      return playerIds.includes(player.id);
    });
    this._addGroupChat({ chatId, players });
  }

  /**
   * Exit the group chat
   * @param chatId single group chat id to be removed from the list.
   */
  _handleRemoveGroupChat(feedback: LegacyFeedback | null = false): void {
    if (feedback) {
      this._request("deleteMessage", this._identity.playerId, [
        "direct",
        feedback,
      ]);
      if (!this._outbox.checkUnique(String(feedback))) return;
    }
    if (!this._isSpectator()) return;

    const groupChats = this._chat.groups;
    if (groupChats.length === 0) return;

    const sendingPlayerId =
      typeof this._identity.stId === "string" ? this._identity.stId : "";
    const receivingPlayerId = this._identity.playerId;

    const message = "[你已退出群聊！]";
    this._handleChat({ message, sendingPlayerId, receivingPlayerId }, null);

    const chatId = groupChats[0]?.id;
    if (!chatId) return;
    this._removeGroupChat({ chatId });
  }

  /**
   * Remove a member (not self) from the group chat
   * @param playerId single id of player to be removed from the group.
   */
  _handleRemoveGroupChatMember(
    playerId: string,
    feedback: LegacyFeedback | null = false,
  ): void {
    if (feedback) {
      this._request("deleteMessage", this._identity.playerId, [
        "direct",
        feedback,
      ]);
      if (!this._outbox.checkUnique(String(feedback))) return;
    }
    if (!this._isSpectator()) return;

    const groupChats = this._chat.groups;
    if (groupChats.length === 0) return;
    const group = groupChats[0];
    if (!group) return;
    const player = group.players.filter((player) => {
      return player.id === playerId;
    })[0];
    if (!player) return;
    const index = group.players.findIndex((player2) => player2.id === playerId);

    const sendingPlayerId =
      typeof this._identity.stId === "string" ? this._identity.stId : "";
    const receivingPlayerId = this._identity.playerId;

    const message = `[（${index + 1}号）${player.name}退出群聊！]`;
    this._handleChat({ message, sendingPlayerId, receivingPlayerId }, null);

    const chatId = group.id;
    this._removeGroupChatMember({ chatId, player });
  }

  /**
   * Sync seated player status.
   * @param isSecretVoteless boolean says if this player is secretly voteless.
   * @param groupChat list of latest player ID in the group chat.
   */
  _handleSyncPlayerStatus({
    isSecretVoteless,
    groupChatPlayers,
    isWraith,
    isUsingWraith,
  }: LegacySessionStatusPayload): void {
    if (!this._isSpectator()) return;
    if (this._identity.claimedSeat === -1) return;

    if (this._voting.isSecretVote && isSecretVoteless) {
      this._gamePlayers.update({
        player: this._gamePlayers.players[this._identity.claimedSeat],
        property: "isVoteless",
        value: isSecretVoteless,
      });
    }

    const groupChats = this._chat.groups;
    if (groupChatPlayers.length > 0) {
      const group = groupChats[0];
      if (group) {
        group.players.forEach((player) => {
          if (!groupChatPlayers.includes(player.id))
            this._handleRemoveGroupChatMember(player.id);
        });
        const inGroupPlayers = group.players.map((player) => player.id);
        const addPlayers = groupChatPlayers.filter(
          (id) => !inGroupPlayers.includes(id),
        );
        if (addPlayers.length > 0) this._handleAddGroupChat(addPlayers);
      } else {
        this._handleAddGroupChat(groupChatPlayers);
      }
    } else {
      if (groupChats.length > 0) this._handleRemoveGroupChat();
    }

    this._roles.setRole({
      role: "wraith",
      property: "active",
      value: isWraith,
    });
    this._roles.setRole({
      role: "wraith",
      property: "using",
      value: isUsingWraith,
      st: true,
    });
  }
}
