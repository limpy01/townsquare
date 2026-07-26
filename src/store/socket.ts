// @ts-nocheck
// MIG-011: Legacy runtime payload narrowing and transport method signatures remain untyped.
// Remove after the transport is split into typed lifecycle and protocol modules.
import { wsBase } from "../config";
import { pinia } from "../pinia";
import {
  isLegacySessionPayload,
  legacySetTalkingPayloadSchema,
} from "@townsquare/contracts/legacy-client-command";
import type {
  LegacyChatPayload,
  LegacyClaimPayload,
  LegacyGameStatePayload,
  LegacyGrimoirePayload,
  LegacyRoleActivityPayload,
  LegacySessionStatusPayload,
  LegacySetTalkingPayload,
  LegacyUsingRolePayload,
} from "@townsquare/contracts/legacy-client-command";
import type { LegacyFeedback } from "@townsquare/contracts/legacy-envelope";
import LiveLobby from "./lobby-transport";
import { showInputModal } from "../services/input-modal";
import type { InputModalRequest } from "../stores/input";
import { useInteractionStore } from "../stores/interaction";
import { useChatStore } from "../stores/chat";
import { useAudioStore } from "../stores/audio";
import { useReviewStore } from "../stores/review";
import { useLegacyOptionsStore } from "../stores/legacy-options";
import type { UseOldOrder, UseOldRole } from "../stores/legacy-options";
import { useSessionConnectionStore } from "../stores/session-connection";
import { useVotingStore } from "../stores/voting";
import { useSessionSettingsStore } from "../stores/session-settings";
import { useRoleActivityStore } from "../stores/role-activity";
import { useProfileStore } from "../stores/profile";
import { useMessageOutboxStore } from "../stores/message-outbox";
import { dispatchSessionInboundMessage } from "./session-message-dispatcher";
import { dispatchSessionMutation } from "./session-mutation-dispatcher";
import {
  dispatchSessionOutboxMessage,
  type SessionOutboxTransport,
} from "./session-outbox-dispatcher";
import { getCustomRolesStripped, rolesJSONbyId } from "./selectors";
import { mutationBus } from "./mutation-bus";
import type { OutboxMessage } from "../stores/message-outbox";
import {
  decodeSessionMessage,
  encodeSessionMessage,
} from "./session-socket-protocol";

type LegacyRuntimePlayer = {
  name: string;
  id: string;
  image: string;
  role: { id?: string; team?: string };
  reminders: Array<{ role?: string }>;
  stReminders: unknown[];
  isDead: boolean;
  isVoteless: boolean;
  isSecretVoteless: boolean;
  isAllowRole: boolean;
  isWraith: boolean;
  isUsingWraith: boolean;
  isTalking: boolean;
  votes: number;
  pronouns: string;
  chatGroup: string;
  [key: string]: unknown;
};

type LegacyRuntimeState = {
  players: { players: LegacyRuntimePlayer[] } & Record<string, unknown>;
  session: { playerId: string; sessionId: string } & Record<string, unknown>;
} & Record<string, unknown>;

type LegacyRuntimeStore = {
  state: LegacyRuntimeState;
  commit(type: string, payload?: unknown): unknown;
};

type ChatOutboxPayload = {
  message: string;
  receivingPlayerId: string;
};

const gameStatePlayerProperties = [
  "name",
  "id",
  "image",
  "stReminders",
  "isDead",
  "isSecretVoteless",
  "isVoteless",
  "pronouns",
  "votes",
] as const;

function isChatOutboxPayload(value: unknown): value is ChatOutboxPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).message === "string" &&
    typeof (value as Record<string, unknown>).receivingPlayerId === "string"
  );
}

function parseSetTalkingPayload(
  value: unknown,
): LegacySetTalkingPayload | null {
  const parsed = legacySetTalkingPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function isTimerSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export class LiveSession {
  private _wss!: string;
  private _socket!: WebSocket | null;
  private _isSpectator!: boolean;
  private _isAlive!: boolean;
  private _gamestate!: Array<Record<string, unknown>>;
  private _store!: LegacyRuntimeStore;
  private _connection!: ReturnType<typeof useSessionConnectionStore>;
  private _review!: ReturnType<typeof useReviewStore>;
  private _legacyOptions!: ReturnType<typeof useLegacyOptionsStore>;
  private _voting!: ReturnType<typeof useVotingStore>;
  private _settings!: ReturnType<typeof useSessionSettingsStore>;
  private _roles!: ReturnType<typeof useRoleActivityStore>;
  private _profile!: ReturnType<typeof useProfileStore>;
  private _outbox!: ReturnType<typeof useMessageOutboxStore>;
  private _chat!: ReturnType<typeof useChatStore>;
  private _pingInterval!: number;
  private _pingTimer!: ReturnType<typeof setTimeout> | null;
  private _sendInterval!: number;
  private _sendTimer!: ReturnType<typeof setTimeout> | null;
  private _reconnectTimer!: ReturnType<typeof setTimeout> | null;
  private _hostTimeout!: ReturnType<typeof setTimeout> | null;
  private _joinTimeout!: ReturnType<typeof setTimeout> | null;
  private _players!: Record<string, number>;
  private _pings!: Record<string, number>;

  constructor(store: LegacyRuntimeStore) {
    this._wss = `${wsBase}/ws/`;
    // this._wss = "ws://localhost:8081/"; // uncomment if using local server with NODE_ENV=development
    // this._wss = "ws://192.168.1.2:8081/"; // uncomment if using local server with NODE_ENV=development
    this._socket = null;
    this._isSpectator = true;
    this._isAlive = true;
    this._gamestate = [];
    this._store = store;
    this._connection = useSessionConnectionStore(pinia);
    this._review = useReviewStore(pinia);
    this._legacyOptions = useLegacyOptionsStore(pinia);
    this._voting = useVotingStore(pinia);
    this._settings = useSessionSettingsStore(pinia);
    this._roles = useRoleActivityStore(pinia);
    this._profile = useProfileStore(pinia);
    this._outbox = useMessageOutboxStore(pinia);
    this._chat = useChatStore(pinia);
    this._pingInterval = 3 * 1000; // 30 seconds between pings
    this._pingTimer = null;
    this._sendInterval = 1.5 * 1000; // 1.5 seconds between unsent message cycles
    this._sendTimer = null;
    this._reconnectTimer = null;
    this._hostTimeout = null;
    this._joinTimeout = null;
    this._players = {}; // map of players connected to a session
    this._pings = {}; // map of player IDs to ping
    // reconnect to previous session
    if (this._store.state.session.sessionId) {
      this.connect(this._store.state.session.sessionId);
    }
  }

  /**
   * Open a new session for the passed channel.
   * @param channel
   * @private
   */
  _open(channel: string) {
    this.disconnect();
    this._socket = new WebSocket(
      this._wss +
        channel +
        "/" +
        this._store.state.session.playerId +
        (!this._isSpectator ? "/host" : "") +
        (!this._isSpectator
          ? "?auth=" + this._store.state.session.stSecret
          : ""),
    );
    if (this._socket === null) {
      this._connection.setIsReconnecting(true);
      this._reconnectTimer = setTimeout(() => this.connect(channel), 3 * 1000);
      return;
    }
    this._socket.addEventListener("message", this._handleMessage.bind(this));
    this._socket.onopen = this._onOpen.bind(this);
    this._socket.onclose = (err: CloseEvent) => {
      this._socket = null;
      clearTimeout(this._pingTimer);
      this._pingTimer = null;
      if (err.code !== 1000) {
        // connection interrupted, reconnect after 3 seconds
        this._connection.setIsReconnecting(true);
        this._reconnectTimer = setTimeout(
          () => this.connect(channel),
          3 * 1000,
        );
      } else {
        // vacate seat upon leaving the room
        this._store.commit("session/claimSeat", -1);

        this._store.commit("session/setSessionId", "");
        this._store.commit("session/setSpectator", false);
        this._connection.setIsHostAllowed(null);
        this._connection.setIsJoinAllowed(null);
        // clear seats and return to intro
        if (this._voting.nomination) {
          this._store.commit("session/nomination");
        }
        // this._store.commit("players/clear", true);

        // clear customBootlegger
        if (this._settings.bootlegger) {
          this._store.commit("session/setBootlegger", "");
        }

        // reset allowed votes
        if (this._voting.playerVotes > 1) {
          this._store.commit("session/setPlayerVotes", 1);
        }

        // reset secret vote
        if (this._voting.isSecretVote) {
          this._store.commit("session/setSecretVote", false);
        }

        // reset review
        if (this._review.isReview) {
          this._store.commit("session/setIsReview", false);
        }

        // reset fabled
        this._store.commit("players/setFabled", {
          fabled: [],
          emptyFabled: true,
        });

        // close chat box
        useInteractionStore(pinia).setChatOpen(false);

        // exit group chat
        this._chat.groups.forEach((group) => {
          this._store.commit("session/removeGroupChat", { chatId: group.id });
        });

        // clear messages
        while (this._outbox.queue.length > 0) {
          this._store.commit("session/deleteMessageQueue", 0);
        }

        // reset wraith
        this._store.commit("session/setIsRole", {
          role: "wraith",
          property: "active",
          value: false,
        });
        this._store.commit("session/setIsRole", {
          role: "wraith",
          property: "using",
          value: false,
          st: true,
        });

        if (err.reason) {
          this.showInputModal({
            inputType: "alert",
            inputModal: "text",
            inputData: {
              name: [err.reason],
            },
          }).catch(() => {
            return null;
          });
        }
      }
    };
  }

  /**
   * Send a message through the socket.
   * @param command
   * @param params
   * @private
   */
  _send(command: string, params: unknown, feedback: LegacyFeedback = false) {
    if (this._socket && this._socket.readyState === 1) {
      this._socket.send(encodeSessionMessage(command, params, feedback));
    }
  }

  /**
   * Send a message directly to a single playerId, if provided.
   * Otherwise broadcast it.
   * @param playerId player ID or "host", optional
   * @param command
   * @param params
   * @private
   */
  _sendDirect(
    playerId: string | null | undefined,
    command: string,
    params: unknown,
    feedback: LegacyFeedback = false,
  ) {
    if (playerId) {
      this._send("direct", { [playerId]: [command, params] }, feedback);
    } else {
      this._send(command, params, feedback);
    }
  }

  /**
   * Request some server side information.
   * @param playerId player ID or "host"
   * @param command
   * @param params
   * @private
   */
  _request(
    command: string,
    playerId: string,
    params?: unknown,
    feedback: LegacyFeedback = false,
  ) {
    this._send("request", { [command]: [playerId, params] }, feedback);
  }

  /**
   * Upload a file to the server (stored).
   * Currently only supports images for avatar pictures
   * @param playerId player ID or "host"
   * @param command
   * @param params
   * @private
   */
  _uploadFile(
    command: string,
    playerId: string | null | undefined,
    params: unknown,
    feedback: LegacyFeedback = false,
  ) {
    if (playerId) {
      this._send("uploadFile", { [command]: [playerId, params] }, feedback);
    }
  }

  _sendQueue() {
    if (this._outbox.queue.length <= 0) return;
    const transport: SessionOutboxTransport = {
      send: (command, params, feedback) =>
        this._send(command, params, feedback),
      sendDirect: (playerId, command, params, feedback) =>
        this._sendDirect(playerId, command, params, feedback),
      request: (command, playerId, params, feedback) =>
        this._request(command, playerId, params, feedback),
      uploadFile: (command, playerId, params, feedback) =>
        this._uploadFile(command, playerId, params, feedback),
    };
    for (const message of this._outbox.queue)
      dispatchSessionOutboxMessage(message, transport);
  }

  _startSendQueue() {
    this._stopSendQueue();
    this._sendQueue();
    this._sendTimer = setInterval(() => {
      this._sendQueue();
    }, this._sendInterval);
  }

  _stopSendQueue() {
    clearInterval(this._sendTimer);
    this._sendTimer = null;
  }

  getPendingMessageCount() {
    return this._outbox.queue.length;
  }

  /**
   *
   * @param id id for identifying and deleting the query
   */
  _deleteFromQueue(id: unknown): void {
    if (!Number.isInteger(id)) return;
    if (this._outbox.queue.length <= 0) return;
    for (let i = 0; i < this._outbox.queue.length; i++) {
      const message = this._outbox.queue[i];
      if (message?.id === id) {
        this._checkQueue(message);
        // this._store.state.session.messageQueue.splice(i,1);
        this._store.commit("session/deleteMessageQueue", i);
        break;
      }
    }
  }

  /**
   *
   * @param message check the specific message and perform certain actions before deleting
   */
  _checkQueue(message: OutboxMessage) {
    if (message.type !== "direct" || message.command !== "chat") return;
    if (!isChatOutboxPayload(message.params)) return;

    const receivingPlayerId =
      message.params.receivingPlayerId === "host"
        ? this._store.state.session.stId
        : message.params.receivingPlayerId;
    this._store.commit("session/updateChatReceived", {
      message: message.params.message,
      playerId: receivingPlayerId,
    });
  }

  /**
   * Open event handler for socket.
   * @private
   */
  _onOpen(): void {
    if (this._isSpectator) {
      this._sendDirect(
        "host",
        "getGamestate",
        this._store.state.session.playerId,
      );
      this._sendDirect("host", "getStId", this._store.state.session.playerId);
      this.checkAllowJoin();
      if (
        this._store.state.session.claimedSeat >= 0 &&
        !this._store.state.session.isListening &&
        !useAudioStore(pinia).isTalking
      ) {
        this._store.commit("session/setTalking", {
          seatNum: this._store.state.session.claimedSeat,
          isTalking: false,
        });
      }
    } else {
      if (this._connection.isHostAllowed === true) {
        this.sendGamestate();
      } else {
        this.checkAllowHost();
      }
    }
    this._ping();
  }

  /**
   * Send a ping message with player ID and ST flag.
   * @private
   */
  _ping(): void {
    this._handlePing();
    this._send("ping", [
      this._isSpectator
        ? this._store.state.session.playerId
        : Object.keys(this._players).length,
      "latency",
    ]);
    clearTimeout(this._pingTimer);
    this._pingTimer = setTimeout(this._ping.bind(this), this._pingInterval);
    // if (this._store.state.session.sessionId &&
    //   !this._isAlive && !this._connection.isReconnecting
    // ) {
    //   this._isAlive = true;
    //   this.connect(this._store.state.session.sessionId);
    // }
    // this._isAlive = false;
  }

  /**
   * Handle an incoming socket message.
   * @param data
   * @private
   */
  _handleMessage({ data }: MessageEvent<unknown>): void {
    const envelope = decodeSessionMessage(data);
    if (!envelope) {
      console.log("unsupported socket message", data);
      return;
    }
    if (!isLegacySessionPayload(envelope.command, envelope.params)) {
      console.log("unsupported socket payload", envelope);
      return;
    }
    dispatchSessionInboundMessage(
      this,
      envelope.command,
      envelope.params,
      envelope.feedback,
    );
  }

  /**
   * Connect to a new live session, either as host or spectator.
   * Set a unique playerId if there isn't one yet.
   * @param channel
   */
  async connect(channel: unknown): Promise<void> {
    const channelNumber =
      typeof channel === "string" || typeof channel === "number"
        ? Number(channel)
        : Number.NaN;
    if (
      !Number.isFinite(channelNumber) ||
      channelNumber < 1 ||
      channelNumber > 10000
    ) {
      this.disconnect();
      this._store.commit("session/setSessionId", "");
      await this._alertPopup("无效的房间号！");
      return;
    }
    if (!this._store.state.session.playerId) {
      let playerId = "";
      // 禁止host、_host和player作为playerId
      while (
        !playerId ||
        playerId === "host" ||
        playerId === "_host" ||
        playerId === "player" ||
        playerId === "default"
      ) {
        playerId = Math.random().toString(36).substr(2);
      }
      this._store.commit("session/setPlayerId", playerId);
    }
    if (!this._store.state.session.stSecret) {
      let stSecret = "";
      // 禁止host、_host和player作为playerId
      while (
        !stSecret ||
        stSecret === "host" ||
        stSecret === "_host" ||
        stSecret === "player" ||
        stSecret === "default"
      ) {
        const array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        // Convert to a URL-safe string (Base64URL)
        stSecret = btoa(String.fromCharCode(...array))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
      }
      this._store.commit("session/setStSecret", stSecret);
    }
    this._pings = {};
    this._connection.setPlayerCount(0);
    this._connection.setPing(0);
    this._isSpectator = this._store.state.session.isSpectator === true;
    if (this._store.state.session.claimedSeat >= 0) {
      this._store.commit("session/setTalking", {
        seatNum: this._store.state.session.claimedSeat,
        isTalking: false,
      });
    }
    this._open(String(channel));
  }

  /**
   * Close the current session, if any.
   */
  disconnect(): void {
    this._pings = {};
    this._connection.setPlayerCount(0);
    this._connection.setPing(0);
    this._connection.setIsReconnecting(false);
    clearTimeout(this._pingTimer);
    this._pingTimer = null;
    this._stopSendQueue();
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    clearTimeout(this._joinTimeout);
    clearTimeout(this._hostTimeout);
    this._joinTimeout = null;
    this._hostTimeout = null;
    if (this._socket) {
      if (this._isSpectator) {
        this._sendDirect("host", "bye", this._store.state.session.playerId);
      }
      this._socket.close(1000);
      this._socket = null;
    }
  }

  /**
   * Alert any messages from the server
   */
  async _alertPopup(text: unknown): Promise<void> {
    if (typeof text !== "string") return;
    await this.showInputModal({
      inputType: "alert",
      inputModal: "text",
      inputData: {
        name: [text],
      },
    }).catch(() => {
      return null;
    });
    return;
  }

  showInputModal(request: InputModalRequest) {
    return showInputModal(request);
  }

  /**
   * Send request to server to check if hosting channel is allowed (no existing hosts).
   */
  async checkAllowHost(): Promise<void> {
    if (this._connection.isHostAllowed === true) return;
    this._request("checkAllowHost", this._store.state.session.playerId);
    this._hostTimeout = setTimeout(async () => {
      if (this._connection.isHostAllowed === null) {
        await this.showInputModal({
          inputType: "alert",
          inputModal: "text",
          inputData: {
            name: ["连接失败，请重新进入房间！"],
          },
        }).catch(() => {
          return null;
        });
        this._store.commit("session/setSessionId", "");
        this._store.commit("session/setSpectator", false);
      }
    }, 6000);
  }

  /**
   * @param allow indicator to if hosting the channel is allowed
   */
  async _handleAllowHost(allow: unknown): Promise<void> {
    if (typeof allow !== "boolean") return;
    if (this._connection.isHostAllowed === true) return;
    clearInterval(this._hostTimeout);
    this._hostTimeout = null;
    this._connection.setIsHostAllowed(allow ? allow : null);

    if (allow) {
      this.sendGamestate();
    } else {
      await this.showInputModal({
        inputType: "alert",
        inputModal: "text",
        inputData: {
          name: [
            `房间"${this._store.state.session.sessionId}"已经存在说书人！`,
          ],
        },
      }).catch(() => {
        return null;
      });
      this._store.commit("session/setSessionId", "");
      this._store.commit("session/setSpectator", false);
    }
  }

  /**
   * Send request to server to check if joining the channel is allowed (has a host).
   */
  checkAllowJoin(): void {
    if (this._connection.isJoinAllowed === true) return;
    this._request("checkAllowJoin", this._store.state.session.playerId);
    this._joinTimeout = setTimeout(async () => {
      if (this._connection.isJoinAllowed === null) {
        await this.showInputModal({
          inputType: "alert",
          inputModal: "text",
          inputData: {
            name: ["连接失败，请重新进入房间！"],
          },
        }).catch(() => {
          return null;
        });
        this._store.commit("session/setSessionId", "");
        this._store.commit("session/setSpectator", false);
      }
    }, 1000);
  }

  /**
   * @param allow indicator to if joining the session is allowed
   */
  async _handleAllowJoin(allow: unknown): Promise<void> {
    if (typeof allow !== "boolean") return;
    if (this._connection.isJoinAllowed === true) return;
    clearInterval(this._joinTimeout);
    this._joinTimeout = null;
    this._connection.setIsJoinAllowed(allow ? allow : null);

    if (allow) {
      this._sendDirect(
        "host",
        "getGamestate",
        this._store.state.session.playerId,
      );
      this._sendDirect("host", "getStId", this._store.state.session.playerId);
    } else {
      await this.showInputModal({
        inputType: "alert",
        inputModal: "text",
        inputData: {
          name: [`房间"${this._store.state.session.sessionId}"不存在！`],
        },
      }).catch(() => {
        return null;
      });
      this._store.commit("session/setSessionId", "");
      this._store.commit("session/setSpectator", false);
    }
  }

  /**
   * Publish the current gamestate.
   * Optional param to reduce traffic. (send only player data)
   * @param playerId
   * @param isLightweight
   */
  sendGamestate(playerId = "", isLightweight = false) {
    if (this._isSpectator) return;
    this._gamestate = this._store.state.players.players.map((player) => ({
      name: player.name,
      id: player.id,
      image: player.image,
      stReminders: this._review.isReview ? player.stReminders : [],
      isDead: player.isDead,
      isVoteless: player.isVoteless,
      votes: player.votes,
      pronouns: player.pronouns,
      ...(player.role && player.role.team === "traveler"
        ? { roleId: player.role.id }
        : {}),
    }));
    if (isLightweight) {
      this._sendDirect(playerId, "gs", {
        gamestate: this._gamestate,
        isLightweight,
      });
    } else {
      const { grimoire, states, teamsNames, firstNight, otherNight } =
        this._store.state;
      const voting = this._voting;
      const { fabled } = this._store.state.players;
      this.sendEdition(playerId);
      let votes = voting.nomination ? Array.from(voting.votes) : []; // 调整闭眼投票，只会发送各玩家自己的真实投票情况，其余均为不投票
      if (voting.isSecretVote && playerId === "") {
        votes = [];
      } else if (voting.isSecretVote && votes.length > 0) {
        const playerIndex = this._store.state.players.players.findIndex(
          (player) => player.id === playerId,
        );
        for (let i = 0; i < votes.length; i++) {
          // 如果不与playerIndex相同则调整至不投票状态
          if (i != playerIndex && votes[i] === true) votes[i] = false;
        }
      }
      this._sendDirect(playerId, "gs", {
        gamestate: this._gamestate,
        isNight: grimoire.isNight,
        isVoteHistoryAllowed: voting.isVoteHistoryAllowed,
        isSecretVote: voting.isSecretVote,
        isUseOldOrder: this._legacyOptions.useOldOrder,
        isUseOldRole: this._legacyOptions.useOldRole,
        isReview: this._review.isReview,
        nomination: voting.nomination,
        votingSpeed: voting.votingSpeed,
        lockedVote: voting.lockedVote,
        isVoteInProgress: voting.isVoteInProgress,
        markedPlayer: voting.isSecretVote ? voting.markedPlayer : -1,
        fabled,
        states,
        teamsNames,
        firstNight,
        otherNight,
        ...(voting.nomination ? { votes } : {}),
      });
    }

    if (this._review.isReview) {
      this.distributeGrimoire(playerId ? { playerId } : { all: true });
    }

    // 场内玩家更新
    const playerIndex = !playerId
      ? -1
      : this._store.state.players.players.findIndex(
          (player) => player.id === playerId,
        );
    const groups = {};
    if (!playerId || playerIndex > -1) {
      const selectedPlayers = !playerId
        ? this._store.state.players.players.filter((player) => !!player.id)
        : [this._store.state.players.players[playerIndex]];

      // 群聊
      const chatIds = [
        ...new Set(selectedPlayers.map((player) => player.chatGroup)),
      ];
      const groupChats = this._chat.groups.filter((group) =>
        chatIds.includes(group.id),
      );
      groupChats.forEach((group) => {
        const playerIds = group.players.map((player) => player.id);
        groups[group.id] = playerIds;
      });

      selectedPlayers.forEach((player) => {
        this._sendDirect(player.id, "syncPlayersStatus", {
          isSecretVoteless: player.isSecretVoteless,
          groupChatPlayers:
            groups[player.chatGroup] === undefined
              ? []
              : groups[player.chatGroup],
          isWraith: player.isWraith,
          isUsingWraith: player.isUsingWraith,
        });
      });
    }
  }

  /**
   * Update the gamestate based on incoming data.
   * @param data
   * @private
   */
  _updateGamestate(data: LegacyGameStatePayload): void {
    if (!this._isSpectator) return;
    const {
      gamestate,
      isLightweight,
      isNight,
      isVoteHistoryAllowed,
      isSecretVote,
      isUseOldOrder,
      isUseOldRole,
      isReview,
      nomination,
      votingSpeed,
      votes,
      lockedVote,
      isVoteInProgress,
      markedPlayer,
      fabled,
      states,
      teamsNames,
      firstNight,
      otherNight,
    } = data;
    const players = this._store.state.players.players;
    // adjust number of players
    if (players.length < gamestate.length) {
      for (let x = players.length; x < gamestate.length; x++) {
        this._store.commit("players/add", gamestate[x].name);
      }
    } else if (players.length > gamestate.length) {
      for (let x = players.length; x > gamestate.length; x--) {
        this._store.commit("players/remove", x - 1);
      }
    }
    // update status for each player
    gamestate.forEach((state, x) => {
      const player = players[x];
      if (!player) return;
      const { roleId } = state;
      // update relevant properties
      gameStatePlayerProperties.forEach((property) => {
        const value = state[property];
        if (player[property] !== value) {
          if (property === "isVoteless") {
            if (value || !player.isSecretVoteless)
              this._store.commit("players/update", { player, property, value });
          } else {
            this._store.commit("players/update", { player, property, value });
          }
        }
      });
      // roles are special, because of travelers
      if (roleId && player.role.id !== roleId) {
        const role =
          this._store.state.roles.get(roleId) || rolesJSONbyId.get(roleId);
        if (role) {
          this._store.commit("players/update", {
            player,
            property: "role",
            value: role,
          });
        }
      } else if (!roleId && player.role.team === "traveler") {
        this._store.commit("players/update", {
          player,
          property: "role",
          value: {},
        });
      }
    });
    if (!isLightweight) {
      this._store.commit("toggleNight", !!isNight);
      this._store.commit("session/setVoteHistoryAllowed", isVoteHistoryAllowed);
      this._store.commit("session/setSecretVote", isSecretVote);
      this._store.commit("session/setUseOldOrder", isUseOldOrder);
      this._store.commit("session/setUseOldRole", isUseOldRole);
      this._store.commit("session/setIsReview", isReview);
      const nominatedPlayer =
        Array.isArray(nomination) && nomination.length > 1
          ? players[Number(nomination[1])] ?? null
          : null;
      this._store.commit("session/nomination", {
        nomination,
        votes,
        votingSpeed,
        lockedVote,
        isVoteInProgress,
        nominatedPlayer,
      });
      this._store.commit("session/setMarkedPlayer", {
        val: markedPlayer,
        force: false,
      });
      this._store.commit("players/setFabled", { fabled });
      this._store.commit("setStates", states);
      this._store.commit("setTeamsNames", teamsNames);
      this._store.commit("setFirstNight", firstNight);
      this._store.commit("setOtherNight", otherNight);
    }
  }

  sendStId(playerId = "") {
    if (this._isSpectator) return;
    this._sendDirect(playerId, "stId", this._store.state.session.playerId);
  }

  _updateStId(data: string): void {
    if (!this._isSpectator) return;
    // this._store.state.session.stId = data;
    this._store.commit("session/setStId", data);
  }

  /**
   * Publish an edition update. ST only
   * @param playerId
   */
  sendEdition(playerId = "") {
    if (this._isSpectator) return;
    const { edition } = this._store.state;
    let roles;
    if (!edition.isOfficial) {
      roles = getCustomRolesStripped(this._store.state.roles.values());
    }
    this._sendDirect(playerId, "edition", {
      edition: edition.isOfficial ? { id: edition.id } : edition,
      ...(roles ? { roles } : {}),
    });
  }

  /**
   * Update edition and roles for custom editions.
   * @param edition
   * @param roles
   * @private
   */
  async _updateEdition({ edition, roles }) {
    if (!this._isSpectator) return;
    this._store.commit("setEdition", edition);
    if (roles) {
      this._store.commit("setCustomRoles", roles);
      if (this._store.state.roles.size !== roles.length) {
        const missing = [];
        roles.forEach(({ id }) => {
          if (!this._store.state.roles.get(id)) {
            missing.push(id);
          }
        });
        await this.showInputModal({
          inputType: "alert",
          inputModal: "text",
          inputData: {
            name: [
              `此剧本中有未收录的角色。` +
                `请先加载这些角色！` +
                `这些角色包含：${missing.join("，")}`,
            ],
          },
        }).catch(() => {
          return null;
        });
        this._store.commit("toggleModal", "edition");
      }
    }
  }

  /**
   * Publish a states update. ST only
   * @param playerId
   */
  sendStates(playerId = "") {
    if (this._isSpectator) return;
    const { states } = this._store.state;
    this._sendDirect(playerId, "states", states);
  }

  /**
   * Update states for custom editions.
   * @param states
   * @private
   */
  _updateStates(states) {
    if (!this._isSpectator) return;
    this._store.commit("setStates", states);
  }

  /**
   * Publish a teams alias update. ST only
   * @param playerId
   */
  sendTeamsNames(playerId = "") {
    if (this._isSpectator) return;
    const { teamsNames } = this._store.state;
    this._sendDirect(playerId, "teamsNames", teamsNames);
  }

  /**
   * Update teamsNames for custom editions.
   * @param teamsNames
   * @private
   */
  _updateTeamsNames(teamsNames) {
    if (!this._isSpectator) return;
    this._store.commit("setTeamsNames", teamsNames);
  }

  /**
   * Publish a firstNight update. ST only
   * @param playerId
   */
  sendFirstNight(playerId = "") {
    if (this._isSpectator) return;
    const { firstNight } = this._store.state;
    this._sendDirect(playerId, "firstNight", firstNight);
  }

  /**
   * Update firstNight.
   * @param firstNight
   * @private
   */
  _updateFirstNight(firstNight) {
    if (!this._isSpectator) return;
    this._store.commit("setFirstNight", firstNight);
  }

  /**
   * Publish an otherNight update. ST only
   * @param playerId
   */
  sendOtherNight(playerId = "") {
    if (this._isSpectator) return;
    const { otherNight } = this._store.state;
    this._sendDirect(playerId, "otherNight", otherNight);
  }

  /**
   * Update otherNight.
   * @param otherNight
   * @private
   */
  _updateOtherNight(otherNight) {
    if (!this._isSpectator) return;
    this._store.commit("setOtherNight", otherNight);
  }

  /**
   * Publish a fabled update. ST only
   */
  sendFabled() {
    if (this._isSpectator) return;
    const { fabled } = this._store.state.players;
    this._send("fabled", fabled);
  }

  /**
   * Update fabled roles.
   * @param fabled
   * @private
   */
  _updateFabled(fabled) {
    if (!this._isSpectator) return;
    this._store.commit("players/setFabled", {
      fabled,
    });
  }

  /**
   * Publish a player update.
   * @param player
   * @param property
   * @param value
   */
  sendPlayer({ player, property, value }) {
    if (
      this._isSpectator ||
      property === "reminders" ||
      (property === "stReminders" && !this._review.isReview)
    )
      return;
    const index = this._store.state.players.players.indexOf(player);
    const staticProperties = ["isAllowRole"];
    if (property === "role") {
      if (this._review.isReview || (value.team && value.team === "traveler")) {
        // update local gamestate to remember this player as a traveler
        if (value.team && value.team === "traveler" && this._gamestate[index])
          this._gamestate[index].roleId = value.id;
        this._send("player", {
          index,
          property,
          value: value.id,
        });
        if (
          this._review.isReview &&
          value.team != "traveler" &&
          this._gamestate[index] &&
          this._gamestate[index].roleId
        )
          delete this._gamestate[index].roleId;
      } else if (this._gamestate[index] && this._gamestate[index].roleId) {
        // player was previously a traveler
        delete this._gamestate[index].roleId;
        this._send("player", { index, property, value: "" });
      }
    } else if (property === "isSecretVoteless") {
      this._sendDirect(player.id, "player", { index, property, value });
    } else if (property === "isWraith") {
      this._sendDirect(player.id, "isRole", {
        role: "wraith",
        property: "active",
        value,
      });
    } else if (property === "isUsingWraith") {
      this._sendDirect(player.id, "isRole", {
        role: "wraith",
        property: "using",
        value,
        st: true,
      });
    } else if (!staticProperties.includes(property)) {
      this._send("player", { index, property, value });
    }
  }

  /**
   * Update a player based on incoming data. Player only.
   * @param index
   * @param property
   * @param value
   * @private
   */
  _updatePlayer({ index, property, value }) {
    if (!this._isSpectator) return;
    const player = this._store.state.players.players[index];
    if (!player) return;
    // special case where a player stops being a traveler
    if (property === "role") {
      if (!value && player.role.team === "traveler") {
        // reset to an unknown role
        this._store.commit("players/update", {
          player,
          property: "role",
          value: {},
        });
      } else {
        // load role, first from session, the global, then fail gracefully
        const role =
          this._store.state.roles.get(value) || rolesJSONbyId.get(value) || {};
        this._store.commit("players/update", {
          player,
          property: "role",
          value: role,
        });
      }
    } else if (property === "isSecretVoteless") {
      // if (value === true) {
      this._store.commit("players/update", { player, property, value });
      // 如果是玩家则同时移除投票标记
      if (player.id === this._store.state.session.playerId && value) {
        this._store.commit("players/update", {
          player,
          property: "isVoteless",
          value,
        });
      }
      // }
    } else if (property === "isVoteless") {
      if (!player.isSecretVoteless || value)
        this._store.commit("players/update", { player, property, value });
    } else {
      // just update the player otherwise
      this._store.commit("players/update", { player, property, value });
    }
  }

  emptyPlayer({ id }) {
    if (id === "") return; //必须指定玩家
    this._sendDirect(id, "leaveSeat");
  }

  _updateLeaveSeat() {
    this._store.state.session.claimedSeat = -1;
  }

  /**
   * Publish a player pronouns update
   * @param player
   * @param value
   * @param isFromSockets
   */
  sendPlayerPronouns({ player, value, isFromSockets }) {
    //send pronoun only for the seated player or storyteller
    //Do not re-send pronoun data for an update that was recieved from the sockets layer
    if (
      isFromSockets ||
      (this._isSpectator && this._store.state.session.playerId !== player.id)
    )
      return;
    const index = this._store.state.players.players.indexOf(player);
    this._send("pronouns", [index, value]);
  }

  /**
   * Update a pronouns based on incoming data.
   * @param index
   * @param value
   * @private
   */
  _updatePlayerPronouns([index, value]: [number, string]): void {
    const player = this._store.state.players.players[index];

    this._store.commit("players/update", {
      player,
      property: "pronouns",
      value,
      isFromSockets: true,
    });
  }

  /**
   * Update a role using status, player only.
   * @param role role to be updated
   * @param property property in the role set to be
   * @param value value to be updated
   */
  setIsRole({ role, property, value, st }: LegacyRoleActivityPayload): void {
    if (st === true) return;
    if (!this._isSpectator) return;
    if (property !== "using") return;
    if (role !== "wraith" || !this._roles.wraith) return;
    this._sendDirect("host", "usingRole", {
      role,
      value,
      playerId: this._store.state.session.playerId,
    });
  }

  /**
   * Update a role status.
   * @param role role to be updated
   * @param property property in the role set to be updated
   * @param value value to be updated
   */
  _updateIsRole({
    role,
    property,
    value,
    st,
  }: LegacyRoleActivityPayload): void {
    if (!this._isSpectator && property !== "using") return;
    if (this._isSpectator && property === "using" && !st) return;
    this._store.commit("session/setIsRole", { role, property, value, st });
  }

  /**
   * Update a role status.
   * @param role role to be updated
   * @param property property in the role set to be updated
   * @param value value to be updated
   */
  _updateUsingRole({ role, value, playerId }: LegacyUsingRolePayload): void {
    if (this._isSpectator) return;
    const index = this._store.state.players.players.findIndex(
      (player) => player.id === playerId,
    );
    if (index === -1) return;
    const player = this._store.state.players.players[index];
    if (role === "wraith") {
      if (player.isWraith) {
        this._store.commit("players/update", {
          player,
          property: "isUsingWraith",
          value,
        });
      } else {
        this._store.commit("players/update", {
          player,
          property: "isWraith",
          value: false,
        });
        this._store.commit("players/update", {
          player,
          property: "isUsingWraith",
          value: false,
        });
      }
    }
  }

  /**
   * Upload avatar image to the server and create a link.
   * @param image
   */
  uploadAvatar(image) {
    this._uploadFile("uploadAvatar", this._store.state.session.playerId, image);
  }

  /**
   * Confirmation on receiving the uploaded image.
   * @param image
   */
  async _avatarReceived(link: string): Promise<void> {
    const playerId = this._store.state.session.playerId;
    const linkId = link.split(".")[0];
    if (playerId != linkId) return;

    this._store.commit("session/updatePlayerAvatar", link);
    await this.showInputModal({
      inputType: "alert",
      inputModal: "text",
      inputData: {
        name: ["头像上传成功！"],
      },
    }).catch(() => {
      return null;
    });
    return;
  }

  /**
   * Handle a ping message by another player / storyteller
   * @param playerIdOrCount
   * @param latency
   * @private
   */
  _handlePing([playerIdOrCount = 0, latency] = []) {
    const now = new Date().getTime();
    // if (!this._players.length) return;
    if (!this._isSpectator) {
      // store new player data
      if (playerIdOrCount) {
        this._players[playerIdOrCount] = now;
        const ping = parseInt(latency, 10);
        if (ping && ping > 0 && ping < 30 * 1000) {
          // ping to Players
          this._pings[playerIdOrCount] = ping;
          const pings = Object.values(this._pings);
          this._connection.setPing(
            Math.round(pings.reduce((a, b) => a + b, 0) / pings.length),
          );
        }
      }
    } else if (latency) {
      // ping to ST
      this._connection.setPing(parseInt(latency, 10));
    }
    // update player count
    if (!this._isSpectator || playerIdOrCount) {
      this._connection.setPlayerCount(
        this._isSpectator ? playerIdOrCount : Object.keys(this._players).length,
      );
    }
  }

  _handlePong() {
    this._isAlive = true;
  }

  /**
   * Handle a player leaving the sessions. ST only
   * @param playerId
   * @private
   */
  _handleBye(playerId: string): void {
    if (this._isSpectator) return;
    delete this._players[playerId];
    this._connection.setPlayerCount(Object.keys(this._players).length);
  }

  /**
   * Claim a seat, needs to be confirmed by the Storyteller.
   * Seats already occupied can't be claimed.
   * @param seat either -1 to vacate or the index of the seat claimed
   */
  claimSeat(seat: unknown): void {
    if (!this._isSpectator) return;
    if (typeof seat !== "number" || !Number.isInteger(seat) || seat < -1)
      return;
    const players = this._store.state.players.players;
    if (players.length > seat && (seat < 0 || !players[seat].id)) {
      // this._send("claim", [seat, this._store.state.session.playerId, this._profile.playerName, this._profile.playerAvatar]);
      this._sendDirect("host", "claim", [
        seat,
        this._store.state.session.playerId,
        this._profile.playerName,
        this._profile.playerAvatar,
      ]);
    }
  }

  /**
   * Update a player id associated with that seat.
   * @param index seat index or -1
   * @param value playerId to add / remove
   * @private
   */
  _updateSeat([index, value, name, image]: LegacyClaimPayload): void {
    // index is the seat number, value is the playerId, name is the playerName
    if (this._isSpectator) return;
    // const property = "id";
    const players = this._store.state.players.players;
    if (index >= 0 && players[index].id) return;
    // remove previous seat
    const oldIndex = players.findIndex(({ id }) => id === value);
    if (oldIndex >= 0 && oldIndex !== index) {
      if (players[oldIndex].chatGroup != "") {
        const player = players[oldIndex];
        const chatId = player.chatGroup;
        this._store.commit("session/removeGroupChatMember", { chatId, player });
      }
      this._store.commit("players/update", {
        player: players[oldIndex],
        property: "id",
        value: "",
      });
      // this._store.commit("players/update", {
      //   player: players[oldIndex],
      //   property: "name",
      //   value: ""
      // });
      // this._store.commit("players/update", {
      //   player: players[oldIndex],
      //   property: "image",
      //   value: ""
      // });
      if (players[oldIndex].isTalking === true) {
        this._store.commit("players/update", {
          player: players[oldIndex],
          property: "isTalking",
          value: false,
        });
      }
      if (players[oldIndex].isWraith === true) {
        this._store.commit("players/update", {
          player: players[oldIndex],
          property: "isWraith",
          value: false,
        });
      }
      if (players[oldIndex].isUsingWraith === true) {
        this._store.commit("players/update", {
          player: players[oldIndex],
          property: "isUsingWraith",
          value: false,
        });
      }
      if (players[oldIndex].isAllowRole === false) {
        this._store.commit("players/update", {
          player: players[oldIndex],
          property: "isAllowRole",
          value: true,
        });
      }
    }
    // add playerId to new seat
    if (index >= 0) {
      const player = players[index];
      if (!player) return;
      this._store.commit("players/update", {
        player,
        property: "image",
        value: image,
      });
      this._store.commit("players/update", {
        player,
        property: "name",
        value: name,
      });
      this._store.commit("players/update", { player, property: "id", value });
    }
    // update player session list as if this was a ping
    this._handlePing([true, value, 0]);
  }

  /**
   * Create a chat history for a playerID.
   * @param index seat index (only created when seat claimed but not removed)
   * @param value playerId to add
   * @private
   */
  _createChatHistory([index]: LegacyClaimPayload): void {
    if (index < 0) return;
    const playerId = this._store.state.players.players[index].id;
    if (playerId === "") return;
    if (this._chat.histories.some((history) => history.id === playerId)) return;
    if (this._isSpectator && this._store.state.session.playerId != playerId)
      return;
    this._store.commit("session/createChatHistory", playerId);
  }

  /**
   * Distribute player roles to all seated players in a direct message.
   * This will be split server side so that each player only receives their own (sub)message.
   */
  distributeRoles() {
    if (this._isSpectator) return;
    const message = {};
    this._store.state.players.players.forEach((player, index) => {
      if (player.id && player.role) {
        message[player.id] = [
          "player",
          { index, property: "role", value: player.role.id },
        ];
      }
    });
    if (Object.keys(message).length) {
      this._send("direct", message);
    }
  }

  /**
   * Distribute player types to all seated players in a direct message.
   * This will be split server side so that each player only receives their own (sub)message.
   */
  distributeTypes() {
    if (this._isSpectator) return;
    const message = {};
    this._store.state.players.players.forEach((player, index) => {
      if (player.id && player.role) {
        message[player.id] = [
          "player",
          {
            index,
            property: "role",
            value:
              player.role.team === "traveler"
                ? player.role.id
                : player.role.team + "s",
          }, //角色类型图标均有s后缀
        ];
      }
    });
    if (Object.keys(message).length) {
      this._send("direct", message);
    }
  }

  /**
   * Distribute bluffs to demon, lunatic, minion players.
   * This will be split server side so that each player only receives their own (sub)message.
   * @param all is the boolean indicator if sending bluffs to everyone
   * @param role is the role being sent a bluffs
   * @param seatNum is the seat number being sent a bluffs
   * @param playerId is the playerId being sent a bluffs, may or may not be seated.
   */
  distributeBluffs({ all, role, seatNum, playerId }) {
    if (this._isSpectator) return;
    if (!all && !seatNum && !playerId && !role) return;

    if (all) {
      this._send("bluff", this._store.state.players.bluffs);
      return;
    }
    if (playerId) {
      this._sendDirect(playerId, "bluff", this._store.state.players.bluffs);
      return;
    }
    if (seatNum) {
      playerId = this._store.state.players.players[seatNum - 1].id;
      this._sendDirect(playerId, "bluff", this._store.state.players.bluffs);
      return;
    }

    let team;
    switch (role) {
      case "demon":
      case "lunatic":
      case "demonAll":
        team = "demon";
        break;
      case "snitch":
      case "widow":
      case "spy":
        team = "minion";
        break;
    }

    const message = {};
    this._store.state.players.players.forEach((player) => {
      if (player.id && player.role && player.role.team == team) {
        if (team === "demon") {
          let lunatic = false;
          player.reminders.forEach((reminder) => {
            if (reminder.role === "lunatic") {
              lunatic = true;
              return;
            }
          });
          if ((role === "lunatic" && !lunatic) || (role === "demon" && lunatic))
            return;
        } else if (
          (role === "widow" || role === "spy") &&
          player.role.id != role
        )
          return;
        message[player.id] = ["bluff", this._store.state.players.bluffs];
      }
    });
    if (Object.keys(message).length) {
      this._send("direct", message);
    }
  }

  /**
   * Update demon bluffs based on incoming data. Demon/Luantic only.
   * @param bluffs
   */
  _updateBluff(bluffs) {
    if (!this._isSpectator) return;
    this._store.commit("players/updateBluff", bluffs);
  }

  /**
   * Distribute grimoire to designated players.
   * Takes one of the arguments, everything else will be null.
   * role, seatNum, playerId in a direct message.
   * This will be split server side so that each player only receives their own (sub)message.
   * @param all is the boolean indicator if sending grimoire to everyone
   * @param role is the role being sent a grimoire
   * @param seatNum is the seat number being sent a grimoire
   * @param playerId is the playerId being sent a grimoire, may or may not be seated.
   */
  distributeGrimoire({ all, role, seatNum, playerId }) {
    if (this._isSpectator) return;
    if (!all && !seatNum && !playerId && !role) return;

    const fullGrimoire = !!all || !!playerId ? false : true;

    const message = {};
    if (!role) {
      // not specifying a role
      message.roles = [];
      if (fullGrimoire) {
        message.reminders = [];
      }
      if (all) {
        message.stReminders = [];
      }
      this._store.state.players.players.forEach((player, index) => {
        message.roles.push([
          { index, property: "role", value: player.role.id },
        ]);
        if (fullGrimoire) {
          message.reminders.push([
            { index, property: "reminder", value: player.reminders },
          ]);
        }
        if (all) {
          message.stReminders.push([
            { index, property: "stReminder", value: player.stReminders },
          ]);
        }
      });
      if (Object.keys(message.roles).length) {
        if (all) this._send("grimoire", message);
        if (playerId) this._sendDirect(playerId, "grimoire", message);
        if (seatNum) {
          playerId = this._store.state.players.players[seatNum - 1].id;
          this._sendDirect(playerId, "grimoire", message);
        }
      }
    } else {
      // send all roles and reminders when requesting full grimoire (i.e. widow or spy)
      this._store.state.players.players.forEach((player) => {
        if (player.id && player.role && player.role.id == role) {
          message[player.id] = ["grimoire", { roles: [], reminders: [] }];
          this._store.state.players.players.forEach((player2, index) => {
            message[player.id][1].roles.push([
              { index, property: "role", value: player2.role.id },
            ]);
            if (fullGrimoire) {
              message[player.id][1].reminders.push([
                { index, property: "reminder", value: player2.reminders },
              ]);
            }
          });
        }
      });
      if (Object.keys(message).length) {
        this._send("direct", message);
      }
    }

    // send bluffs
    this.distributeBluffs({ all, role, seatNum, playerId });
  }

  /**
   * Update grimoire once received
   * @param payload is the grimoire details.
   */
  _updateGrimoire(payload: LegacyGrimoirePayload): void {
    // set roles
    payload.roles.forEach((grimRole) => {
      const update = grimRole[0];
      if (!update) return;
      // load role, first from session, the global, then fail gracefully
      const role =
        (update.value && this._store.state.roles.get(update.value)) ||
        (update.value && rolesJSONbyId.get(update.value)) ||
        {};
      if (role.team === "traveler") return;
      const player = this._store.state.players.players[update.index];
      if (!player) return;
      this._store.commit("players/update", {
        player,
        property: "role",
        value: role,
      });
    });

    // set reminders
    if (payload.reminders) {
      payload.reminders.forEach((grimReminder) => {
        const update = grimReminder[0];
        if (!update || !update.value.length) return;
        const player = this._store.state.players.players[update.index];
        if (!player) return;
        const value = Array.from(player.reminders);
        update.value.forEach((reminder) => {
          if (reminder.role === "custom") return;
          value.push(reminder);
        });
        this._store.commit("players/update", {
          player,
          property: "reminders",
          value,
        });
      });
    }
    // set stReminders
    if (payload.stReminders) {
      payload.stReminders.forEach((grimReminder) => {
        const update = grimReminder[0];
        if (!update || !update.value.length) return;
        const player = this._store.state.players.players[update.index];
        if (!player) return;
        this._store.commit("players/update", {
          player,
          property: "stReminders",
          value: update.value,
        });
      });
    }
  }

  /**
   * A player nomination. ST only
   * This also syncs the voting speed to the players.
   * Payload can be an object with {nomination} property or just the nomination itself, or undefined.
   * @param payload [nominator, nominee]|{nomination}
   */
  nomination(payload) {
    if (this._isSpectator) return;
    const nomination = payload ? payload.nomination || payload : payload;
    const players = this._store.state.players.players;
    if (
      !nomination ||
      (players.length > nomination[0] && players.length > nomination[1])
    ) {
      this.setVotingSpeed(this._voting.votingSpeed);
      this._send("nomination", nomination);
    }
  }

  /**
   * Set the isVoteInProgress status. ST only
   */
  setVoteInProgress() {
    if (this._isSpectator) return;
    this._send("isVoteInProgress", this._voting.isVoteInProgress);
  }

  /**
   * Send the isNight status. ST only
   */
  setIsNight() {
    if (this._isSpectator) return;
    this._send("isNight", this._store.state.grimoire.isNight);
  }

  /**
   * Send the isVoteHistoryAllowed state. ST only
   */
  setVoteHistoryAllowed() {
    if (this._isSpectator) return;
    this._send("isVoteHistoryAllowed", this._voting.isVoteHistoryAllowed);
  }

  /**
   * Send the voting speed. ST only
   * @param votingSpeed voting speed in seconds, minimum 1
   */
  setVotingSpeed(votingSpeed) {
    if (this._isSpectator) return;
    if (votingSpeed) {
      this._send("votingSpeed", votingSpeed);
    }
  }

  /**
   * Set which player is on the block. ST only
   * @param playerIndex, player id or -1 for empty
   */
  setMarked(playerIndex) {
    if (this._isSpectator) return;
    if (this._voting.isSecretVote) return;
    this._send("marked", playerIndex);
  }

  /**
   * Clear the vote history for everyone. ST only
   */
  clearVoteHistory() {
    if (this._isSpectator) return;
    this._send("clearVoteHistory");
  }

  /**
   * Send a vote. Player or ST
   * @param index Seat of the player
   * @param sync Flag whether to sync this vote with others or not
   */
  vote([index]) {
    const player = this._store.state.players.players[index];
    if (
      this._store.state.session.playerId === player.id ||
      !this._isSpectator
    ) {
      if (
        this._store.state.players.players[this._voting.nomination[1]].role
          .team === "traveler" ||
        !this._voting.isSecretVote
      ) {
        // send to everyone if exile or secret vote is off
        // send vote only if it is your own vote or you are the storyteller
        this._send("vote", [
          index,
          this._voting.votes[index],
          !this._isSpectator,
        ]);
      } else {
        // otherwise only send direct messages
        if (this._isSpectator) {
          this._sendDirect("host", "vote", [
            index,
            this._voting.votes[index],
            !this._isSpectator,
          ]);
        } else {
          this._sendDirect(player.id, "vote", [
            index,
            this._voting.votes[index],
            !this._isSpectator,
          ]);
        }
      }
    }
  }

  /**
   * Send a status change to whether anonymous votes are in progress. ST to players only
   */
  setSecretVote(isSecretVote) {
    if (this._isSpectator) return;
    this._send("secretVote", isSecretVote);
  }

  _handleSecretVote(isSecretVote: boolean): void {
    if (!this._isSpectator) return;
    this._voting.setSecretVote(isSecretVote);
  }

  setBootlegger(content) {
    if (this._isSpectator) return;
    this._send("bootlegger", content);
  }

  _handleSetBootlegger(content: string): void {
    if (!this._isSpectator) return;
    this._settings.setBootlegger(content);
  }

  setUseOldOrder(isUseOldOrder) {
    if (this._isSpectator) return;
    this._send("useOldOrder", isUseOldOrder);
  }

  _handleSetUseOldOrder(isUseOldOrder: UseOldOrder): void {
    if (!this._isSpectator) return;
    this._legacyOptions.setUseOldOrder(isUseOldOrder);
  }

  setUseOldRole(isUseOldRole) {
    if (this._isSpectator) return;
    this._send("useOldRole", isUseOldRole);
  }

  _handleSetUseOldRole(isUseOldRole: UseOldRole): void {
    if (!this._isSpectator) return;
    this._legacyOptions.setUseOldRole(isUseOldRole);
  }

  setIsReview(isReview) {
    if (this._isSpectator) return;
    this._send("isReview", isReview);
  }

  _handleSetIsReview(isReview: boolean): void {
    if (!this._isSpectator) return;
    this._review.setReview(isReview);
    if (!isReview) {
      this._store.state.players.players.forEach((player) => {
        this._store.commit("players/update", {
          player,
          property: "stReminders",
          value: [],
        });
      });
    }
  }

  /**
   * Set talking status to true to enable glowing animation
   * Send this update to all clients in the channel
   */
  setTalking(payload: unknown): void {
    const talkingPayload = parseSetTalkingPayload(payload);
    if (!talkingPayload) return;
    if (
      talkingPayload.seatNum < 0 ||
      talkingPayload.seatNum >= this._store.state.players.players.length
    )
      return;
    if (
      !this._store.state.players.players[talkingPayload.seatNum].id ||
      this._store.state.players.players[talkingPayload.seatNum].id !=
        this._store.state.session.playerId
    )
      return;
    this._send("setTalking", talkingPayload);
  }

  /**
   * Set talking status to true to enable glowing animation when received
   */
  _handleSetTalking(payload: LegacySetTalkingPayload): void {
    if (
      payload.seatNum < 0 ||
      payload.seatNum >= this._store.state.players.players.length
    )
      return;
    this._store.state.players.players[payload.seatNum].isTalking =
      payload.isTalking;
  }

  /**
   * Handle an incoming vote, but only if it is from ST or unlocked.
   * @param index
   * @param vote
   * @param fromST
   */
  _handleVote([index, vote, fromST]) {
    // do not reveal vote when anonymous voting is in progress, unless it's ST changing that player's vote
    const voteId = this._store.state.players.players[index].id;
    if (
      this._isSpectator &&
      voteId != this._store.state.session.playerId &&
      this._voting.isSecretVote &&
      this._store.state.players.players[this._voting.nomination[1]].role.team !=
        "traveler"
    )
      return;

    const { players } = this._store.state;
    const voting = this._voting;
    const playerCount = players.players.length;
    const indexAdjusted =
      (index - 1 + playerCount - voting.nomination[1]) % playerCount;
    if (fromST || indexAdjusted >= voting.lockedVote - 1) {
      this._store.commit("session/vote", [index, vote]);
    }
  }

  /**
   * Lock a vote. ST only
   */
  lockVote() {
    if (this._isSpectator) return;
    const { lockedVote, votes, nomination } = this._voting;
    const { players } = this._store.state.players;
    const index = (nomination[1] + lockedVote - 1) % players.length;
    this._send("lock", [this._voting.lockedVote, votes[index]]);
  }

  /**
   * Update vote lock and the locked vote, if it differs. Player only
   * @param lock
   * @param vote
   * @private
   */
  _handleLock([lock, vote]) {
    if (!this._isSpectator) return;
    this._store.commit("session/lockVote", lock);

    if (lock > 1) {
      const { lockedVote, nomination } = this._voting;
      const { players } = this._store.state.players;
      const index = (nomination[1] + lockedVote - 1) % players.length;
      // record as not voted when anonymous voting is in progress
      const displayVote = this._voting.isSecretVote ? false : vote;
      if (this._voting.votes[index] !== vote) {
        this._store.commit("session/vote", [index, displayVote]);
      }
    }
  }

  /**
   * Swap two player seats. ST only
   * @param payload
   */
  swapPlayer(payload) {
    if (this._isSpectator) return;
    this._send("swap", payload);
  }

  /**
   * Move a player to another seat. ST only
   * @param payload
   */
  movePlayer(payload) {
    if (this._isSpectator) return;
    this._send("move", payload);
  }

  /**
   * Remove a player. ST only
   * @param payload
   */
  removePlayer(payload) {
    if (this._isSpectator) return;
    this._send("remove", payload);
  }

  /**
   * Create a group chat. ST only
   * @param chatId id of the chat group
   * @param players players within each chat group
   */
  sendAddGroupChat({ chatId, players, playerIds }) {
    if (this._isSpectator) return;
    if (!!playerIds && !players) return;

    const allPlayersId = this._chat.groups
      .filter((group) => group.id === chatId)[0]
      .players.map((player) => player.id);
    const newPlayersId = players.map((player) => player.id);
    const oldPlayersId = allPlayersId.filter(
      (id) => !newPlayersId.includes(id),
    );

    newPlayersId.forEach((playerId) => {
      this._store.commit("session/addMessageQueue", {
        type: "direct",
        playerId,
        command: "addGroupChat",
        params: allPlayersId,
        id: new Date().getTime(),
      });
    });
    oldPlayersId.forEach((playerId) => {
      this._store.commit("session/addMessageQueue", {
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
  sendRemoveGroupChat({ playerIds }) {
    if (this._isSpectator) return;
    if (!playerIds) return;

    playerIds.forEach((id) => {
      this._store.commit("session/addMessageQueue", {
        type: "direct",
        playerId: id,
        command: "removeGroupChat",
        // params: chatId, // temporarily removing chatId since every user has their own id
        id: new Date().getTime(),
      });
    });
  }

  /**
   * Remove members from a group chat. ST only
   * @param chatId id of the chat group
   * @param player player within the chat group
   */
  sendRemoveGroupChatMember({ chatId, player }) {
    if (this._isSpectator) return;

    this._store.commit("session/addMessageQueue", {
      type: "direct",
      playerId: player.id,
      command: "removeGroupChat",
      // params: chatId, // temporarily removing chatId since every user has their own id
      id: new Date().getTime(),
    });

    const index = this._chat.groups.findIndex((group) => group.id === chatId);
    if (index === -1) return;
    this._chat.groups[index].players.forEach((member) => {
      if (member.id === player.id) return;
      this._store.commit("session/addMessageQueue", {
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
      this._request("deleteMessage", this._store.state.session.playerId, [
        "direct",
        feedback,
      ]);
      if (!this._outbox.checkUnique(String(feedback))) return;
    }
    if (
      this._isSpectator &&
      receivingPlayerId != this._store.state.session.playerId
    )
      return;
    this._store.commit("session/updateChatReceived", {
      message,
      playerId: sendingPlayerId,
    });
    const num = 1;
    if (!this._isSpectator) {
      this._store.commit("players/setPlayerMessage", {
        playerId: sendingPlayerId,
        num,
      });
    } else {
      useChatStore(pinia).addStorytellerUnread(num);
    }

    if (this._isSpectator) return;

    const players = this._store.state.players.players;
    const sendingPlayer = players.filter(
      (player) => player.id === sendingPlayerId,
    );
    if (sendingPlayer.length <= 0) return;
    const chatId = sendingPlayer[0].chatGroup;

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
        this._store.commit("session/updateChatSent", {
          message: wraithMessage,
          sendingPlayerId: this._store.state.session.playerId,
          receivingPlayerId: player.id,
        });
    });
    // 处理暴露
    const prob = this._roles.wraith.prob;
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
      this._store.commit("session/updateChatSent", {
        message: spottedMessage,
        sendingPlayerId: this._store.state.session.playerId,
        receivingPlayerId: sendingPlayerId,
      });
      const indexExposed = players.findIndex(
        (player) => player.id === sendingPlayerId,
      );
      const exposedMessage = `[亡魂][你已被${indexExposed + 1}号发现！！]`;
      this._store.commit("session/updateChatSent", {
        message: exposedMessage,
        sendingPlayerId: this._store.state.session.playerId,
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
      this._store.commit("session/updateChatSent", {
        message,
        sendingPlayerId: this._store.state.session.playerId,
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
      this._request("deleteMessage", this._store.state.session.playerId, [
        "direct",
        feedback,
      ]);
      if (!this._outbox.checkUnique(String(feedback))) return;
    }
    if (!this._isSpectator) return;

    const groupChats = this._chat.groups;
    const names = this._store.state.players.players
      .filter((player) => playerIds.includes(player.id))
      .map((player) => {
        return {
          index: this._store.state.players.players.findIndex(
            (player2) => player2.id === player.id,
          ),
          name: player.name,
        };
      });
    const sendingPlayerId =
      typeof this._store.state.session.stId === "string"
        ? this._store.state.session.stId
        : "";
    const receivingPlayerId = this._store.state.session.playerId;

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
    const players = this._store.state.players.players.filter((player) => {
      return playerIds.includes(player.id);
    });
    this._store.commit("session/addGroupChat", { chatId, players });
  }

  /**
   * Exit the group chat
   * @param chatId single group chat id to be removed from the list.
   */
  _handleRemoveGroupChat(feedback: LegacyFeedback | null = false): void {
    if (feedback) {
      this._request("deleteMessage", this._store.state.session.playerId, [
        "direct",
        feedback,
      ]);
      if (!this._outbox.checkUnique(String(feedback))) return;
    }
    if (!this._isSpectator) return;

    const groupChats = this._chat.groups;
    if (groupChats.length === 0) return;

    const sendingPlayerId =
      typeof this._store.state.session.stId === "string"
        ? this._store.state.session.stId
        : "";
    const receivingPlayerId = this._store.state.session.playerId;

    const message = "[你已退出群聊！]";
    this._handleChat({ message, sendingPlayerId, receivingPlayerId }, null);

    const chatId = groupChats[0]?.id;
    if (!chatId) return;
    this._store.commit("session/removeGroupChat", { chatId });
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
      this._request("deleteMessage", this._store.state.session.playerId, [
        "direct",
        feedback,
      ]);
      if (!this._outbox.checkUnique(String(feedback))) return;
    }
    if (!this._isSpectator) return;

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
      typeof this._store.state.session.stId === "string"
        ? this._store.state.session.stId
        : "";
    const receivingPlayerId = this._store.state.session.playerId;

    const message = `[（${index + 1}号）${player.name}退出群聊！]`;
    this._handleChat({ message, sendingPlayerId, receivingPlayerId }, null);

    const chatId = group.id;
    this._store.commit("session/removeGroupChatMember", { chatId, player });
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
    if (!this._isSpectator) return;
    if (this._store.state.session.claimedSeat === -1) return;

    if (this._voting.isSecretVote && isSecretVoteless) {
      this._store.commit("players/update", {
        player:
          this._store.state.players.players[
            this._store.state.session.claimedSeat
          ],
        property: "isVoteless",
        value: isSecretVoteless,
      });
    }

    const groupChats = this._chat.groups;
    if (groupChatPlayers.length > 0) {
      if (groupChats.length > 0) {
        groupChats[0].players.forEach((player) => {
          if (!groupChatPlayers.includes(player.id))
            this._handleRemoveGroupChatMember(player.id);
        });
        const inGroupPlayers = groupChats[0].players.map((player) => player.id);
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

    this._store.commit("session/setIsRole", {
      role: "wraith",
      property: "active",
      value: isWraith,
    });
    this._store.commit("session/setIsRole", {
      role: "wraith",
      property: "using",
      value: isUsingWraith,
      st: true,
    });
  }

  /**
   * Send out timer. ST only
   * @param payload
   */
  setTimer(payload: unknown): void {
    if (this._isSpectator) return;
    if (!isTimerSeconds(payload)) return;
    this._send("setTimer", payload);
  }

  /**
   * Update timer when received.
   * @param payload
   */
  _handleSetTimer(time: number): void {
    this._store.commit("session/setTimer", time);
  }

  /**
   * Send out starting timer. ST only
   * @param payload
   */
  startTimer(payload: unknown): void {
    if (this._isSpectator) return;
    if (!isTimerSeconds(payload)) return;
    this._send("startTimer", payload);
  }

  /**
   * Starting timer.
   */
  _handleStartTimer(payload: number): void {
    this._store.commit("session/startTimer", payload);
  }

  /**
   * Send out starting timer. ST only
   * @param payload
   */
  stopTimer(_payload: unknown): void {
    if (this._isSpectator) return;
    this._send("stopTimer", undefined);
  }

  /**
   * Starting timer.
   */
  _handleStopTimer() {
    this._store.commit("session/stopTimer");
  }
}

export default (store) => {
  // lobby
  const lobby = new LiveLobby(store);
  if (window.location.pathname === "/") lobby.connect();
  // setup
  const session = new LiveSession(store);

  mutationBus.subscribe((mutation, state: any) => {
    dispatchSessionMutation(session, mutation, state);
  });
};
