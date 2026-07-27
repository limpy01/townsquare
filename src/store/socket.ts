import { wsBase } from "../config";
import { pinia } from "../pinia";
import { isLegacySessionPayload } from "@townsquare/contracts/legacy-client-command";
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
import type { Nomination } from "../stores/voting";
import { useSessionSettingsStore } from "../stores/session-settings";
import {
  useRoleActivityStore,
  type WraithProperty,
} from "../stores/role-activity";
import { useMessageOutboxStore } from "../stores/message-outbox";
import { usePlayersStore } from "../stores/players";
import { useScenarioStore } from "../stores/scenario";
import { useGrimoireStore } from "../stores/grimoire";
import { useSessionIdentityStore } from "../stores/session-identity";
import { useTimerStore } from "../stores/timer";
import { useModalStore } from "../stores/modals";
import { dispatchSessionInboundMessage } from "./session-message-dispatcher";
import { dispatchSessionMutation } from "./session-mutation-dispatcher";
import {
  dispatchSessionOutboxMessage,
  type SessionOutboxTransport,
} from "./session-outbox-dispatcher";
import { SessionOutboxController } from "./session-outbox-controller";
import { getCustomRolesStripped, rolesJSONbyId } from "./selectors";
import { gameEvents } from "./game-events";
import type { OutboxMessage } from "../stores/message-outbox";
import {
  decodeSessionMessage,
  encodeSessionMessage,
} from "./session-socket-protocol";
import {
  buildSessionSocketUrl,
  sessionTransportTiming,
} from "./session-transport-lifecycle";
import { SessionReconnectPolicy } from "./session-reconnect-policy";
import { SessionWebSocketClient } from "./session-websocket-client";
import { SessionChatController } from "./session-chat-controller";
import { SessionVotingController } from "./session-voting-controller";
import { SessionGameStateController } from "./session-game-state-controller";
import { SessionPlayerController } from "./session-player-controller";
import { SessionPlayerDeliveryController } from "./session-player-delivery-controller";
import { SessionSeatController } from "./session-seat-controller";
import {
  gameStatePlayerProperties,
  isAddGroupChatPayload,
  isChatOutboxPayload,
  isLegacyRuntimeRole,
  isSessionOutboundState,
  isTimerSeconds,
  parseSetTalkingPayload,
  type AddGroupChatPayload,
  type ChatOutboxPayload,
  type LegacyRuntimeRole,
  type TargetedDistribution,
} from "./session-transport-guards";

type LegacyRuntimePlayer = {
  name: string;
  id: string;
  image: string;
  role: { id?: string; team?: string };
  reminders: Array<{ role?: string | undefined }>;
  stReminders: Array<{ role?: string | undefined }>;
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

type LegacyRuntimeEdition = {
  id: string;
  isOfficial: boolean;
  [key: string]: unknown;
};

type LegacyEditionPayload = {
  edition: LegacyRuntimeEdition;
  roles?: LegacyRuntimeRole[];
};

type PlayerUpdatePayload = {
  player: LegacyRuntimePlayer;
  property: string;
  value: unknown;
};

type PlayerPronounsPayload = {
  player: LegacyRuntimePlayer;
  value: string;
  isFromSockets: boolean;
};

type GroupChatPlayer = {
  id: string;
  name?: string;
};

type LegacyPingPayload = [
  (string | number | boolean)?,
  (string | number | undefined)?,
  unknown?,
];

type NominationPayload =
  | Nomination
  | { nomination?: Nomination | undefined }
  | null
  | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isVoteValue = (value: unknown): value is boolean | number | undefined =>
  typeof value === "boolean" ||
  typeof value === "number" ||
  value === undefined;

export class LiveSession {
  private _wss!: string;
  private _socketClient!: SessionWebSocketClient;
  _isSpectator!: boolean;
  private _isAlive!: boolean;
  private _gamestate!: Array<Record<string, unknown>>;
  private _gamePlayers!: ReturnType<typeof usePlayersStore>;
  private _scenario!: ReturnType<typeof useScenarioStore>;
  private _grimoire!: ReturnType<typeof useGrimoireStore>;
  private _identity!: ReturnType<typeof useSessionIdentityStore>;
  private _timer!: ReturnType<typeof useTimerStore>;
  private _modals!: ReturnType<typeof useModalStore>;
  private _connection!: ReturnType<typeof useSessionConnectionStore>;
  private _review!: ReturnType<typeof useReviewStore>;
  private _legacyOptions!: ReturnType<typeof useLegacyOptionsStore>;
  private _voting!: ReturnType<typeof useVotingStore>;
  private _settings!: ReturnType<typeof useSessionSettingsStore>;
  private _roles!: ReturnType<typeof useRoleActivityStore>;
  private _outbox!: ReturnType<typeof useMessageOutboxStore>;
  private _chat!: ReturnType<typeof useChatStore>;
  private _chatController!: SessionChatController;
  private _votingController!: SessionVotingController;
  private _gameStateController!: SessionGameStateController;
  private _playerController!: SessionPlayerController;
  private _playerDeliveryController!: SessionPlayerDeliveryController;
  private _seatController!: SessionSeatController;
  private _pingInterval!: number;
  private _pingTimer!: ReturnType<typeof setTimeout> | null;
  private _outboxController!: SessionOutboxController;
  private _reconnect!: SessionReconnectPolicy;
  private _hostTimeout!: ReturnType<typeof setTimeout> | null;
  private _joinTimeout!: ReturnType<typeof setTimeout> | null;
  private _players!: Record<string, number>;
  private _pings!: Record<string, number>;

  constructor() {
    this._wss = `${wsBase}/ws/`;
    // this._wss = "ws://localhost:8081/"; // uncomment if using local server with NODE_ENV=development
    // this._wss = "ws://192.168.1.2:8081/"; // uncomment if using local server with NODE_ENV=development
    this._socketClient = new SessionWebSocketClient();
    this._isSpectator = true;
    this._isAlive = true;
    this._gamestate = [];
    this._gamePlayers = usePlayersStore(pinia);
    this._scenario = useScenarioStore(pinia);
    this._grimoire = useGrimoireStore(pinia);
    this._identity = useSessionIdentityStore(pinia);
    this._timer = useTimerStore(pinia);
    this._modals = useModalStore(pinia);
    this._connection = useSessionConnectionStore(pinia);
    this._review = useReviewStore(pinia);
    this._legacyOptions = useLegacyOptionsStore(pinia);
    this._voting = useVotingStore(pinia);
    this._settings = useSessionSettingsStore(pinia);
    this._roles = useRoleActivityStore(pinia);
    this._outbox = useMessageOutboxStore(pinia);
    this._chat = useChatStore(pinia);
    this._chatController = new SessionChatController({
      isSpectator: () => this._isSpectator,
      request: this._request.bind(this),
      queueChat: this._queueChat.bind(this),
      addGroupChat: this._addGroupChat.bind(this),
      removeGroupChat: this._removeGroupChat.bind(this),
      removeGroupChatMember: this._removeGroupChatMember.bind(this),
    });
    this._votingController = new SessionVotingController({
      isSpectator: () => this._isSpectator,
      send: this._send.bind(this),
      sendDirect: this._sendDirect.bind(this),
    });
    this._gameStateController = new SessionGameStateController({
      isSpectator: () => this._isSpectator,
      send: this._send.bind(this),
      sendDirect: this._sendDirect.bind(this),
      distributeGrimoire: this.distributeGrimoire.bind(this),
      showInputModal: this.showInputModal.bind(this),
    });
    this._playerController = new SessionPlayerController({
      isSpectator: () => this._isSpectator,
      send: this._send.bind(this),
      sendDirect: this._sendDirect.bind(this),
      uploadFile: this._uploadFile.bind(this),
      showInputModal: this.showInputModal.bind(this),
      gamestate: () => this._gameStateController.gamestate,
    });
    this._playerDeliveryController = new SessionPlayerDeliveryController({
      isSpectator: () => this._isSpectator,
      send: this._send.bind(this),
      sendDirect: this._sendDirect.bind(this),
    });
    this._seatController = new SessionSeatController({
      isSpectator: () => this._isSpectator,
      sendDirect: this._sendDirect.bind(this),
      recordPing: this._handlePing.bind(this),
      removeGroupChatMember: this._removeGroupChatMember.bind(this),
    });
    this._pingInterval = sessionTransportTiming.pingIntervalMs;
    this._pingTimer = null;
    this._outboxController = new SessionOutboxController({
      intervalMs: sessionTransportTiming.sendQueueIntervalMs,
      getQueue: () => this._outbox.queue,
      transport: this._createOutboxTransport(),
      onAcknowledged: (message) => this._checkQueue(message),
      deleteAt: (index) => this._outbox.remove(index),
    });
    this._reconnect = new SessionReconnectPolicy(
      sessionTransportTiming.reconnectDelayMs,
    );
    this._hostTimeout = null;
    this._joinTimeout = null;
    this._players = {}; // map of players connected to a session
    this._pings = {}; // map of player IDs to ping
    // reconnect to previous session
    if (this._identity.sessionId) {
      this.connect(this._identity.sessionId);
    }
  }

  /**
   * Open a new session for the passed channel.
   * @param channel
   * @private
   */
  _open(channel: string) {
    this.disconnect();
    this._socketClient.open(
      buildSessionSocketUrl(this._wss, {
        channel,
        playerId: this._identity.playerId,
        isSpectator: this._isSpectator,
        hostSecret: this._identity.stSecret,
      }),
      {
        onMessage: this._handleMessage.bind(this),
        onOpen: this._onOpen.bind(this),
        onClose: (event) => this._handleSocketClose(channel, event),
      },
    );
    if (!this._socketClient.isConnected) {
      this._connection.setIsReconnecting(true);
      this._reconnect.schedule(() => this.connect(channel));
    }
  }

  private _handleSocketClose(channel: string, err: CloseEvent): void {
    if (this._pingTimer !== null) clearTimeout(this._pingTimer);
    this._pingTimer = null;
    if (err.code !== 1000) {
      // connection interrupted, reconnect after 3 seconds
      this._connection.setIsReconnecting(true);
      this._reconnect.schedule(() => this.connect(channel));
    } else {
      // vacate seat upon leaving the room
      this._identity.claimSeat(-1);

      this._identity.setSessionId("");
      this._identity.setSpectator(false);
      this._connection.setIsHostAllowed(null);
      this._connection.setIsJoinAllowed(null);
      // clear seats and return to intro
      if (this._voting.nomination) {
        this._setNomination();
      }
      // clear customBootlegger
      if (this._settings.bootlegger) {
        this._settings.setBootlegger("");
      }

      // reset allowed votes
      if (this._voting.playerVotes > 1) {
        this._voting.setPlayerVotes(1);
      }

      // reset secret vote
      if (this._voting.isSecretVote) {
        this._voting.setSecretVote(false);
      }

      // reset review
      if (this._review.isReview) {
        this._review.setReview(false);
      }

      // reset fabled
      this._gamePlayers.setFabled({
        fabled: [],
        emptyFabled: true,
      });

      // close chat box
      useInteractionStore(pinia).setChatOpen(false);

      // exit group chat
      this._chat.groups.forEach((group) => {
        this._removeGroupChat({ chatId: group.id });
      });

      // clear messages
      while (this._outbox.queue.length > 0) {
        this._outbox.remove(0);
      }

      // reset wraith
      this._roles.setRole({
        role: "wraith",
        property: "active",
        value: false,
      });
      this._roles.setRole({
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
  }

  /**
   * Send a message through the socket.
   * @param command
   * @param params
   * @private
   */
  _send(command: string, params: unknown, feedback: LegacyFeedback = false) {
    this._socketClient.send(encodeSessionMessage(command, params, feedback));
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

  private _createOutboxTransport(): SessionOutboxTransport {
    return {
      send: (command, params, feedback) =>
        this._send(command, params, feedback),
      sendDirect: (playerId, command, params, feedback) =>
        this._sendDirect(playerId, command, params, feedback),
      request: (command, playerId, params, feedback) =>
        this._request(command, playerId, params, feedback),
      uploadFile: (command, playerId, params, feedback) =>
        this._uploadFile(command, playerId, params, feedback),
    };
  }

  private _setTalking(payload: { seatNum: number; isTalking: boolean }): void {
    useAudioStore(pinia).setTalking(payload.isTalking);
    this._gamePlayers.setTalking({
      ...payload,
      playerId: this._identity.playerId,
    });
  }

  private _setNomination(payload?: unknown): void {
    this._voting.setNomination(
      payload === null ? undefined : (payload as never),
      {
        isSecretVote: this._voting.isSecretVote,
        claimedSeat: this._identity.claimedSeat,
      },
    );
  }

  private _setMarkedPlayer(
    payload: number | { val?: number; force?: boolean },
  ): void {
    this._voting.setMarkedPlayer(payload, {
      isSecretVote: this._voting.isSecretVote,
    });
  }

  private _queueChat(payload: ChatOutboxPayload): void {
    if (
      !this._identity.isSpectator ||
      payload.sendingPlayerId === this._identity.playerId
    ) {
      this._outbox.add({
        type: "direct",
        playerId: payload.receivingPlayerId,
        command: "chat",
        params: payload,
        id: new Date().getTime(),
      });
    }
  }

  private _addGroupChat({ chatId, players }: AddGroupChatPayload): void {
    this._chat
      .addGroup({
        chatId,
        players: players.map(({ id, name }) =>
          name === undefined ? { id } : { id, name },
        ),
      })
      .forEach((change) => this._gamePlayers.update(change));
  }

  private _removeGroupChat({ chatId }: { chatId: string }): void {
    this._chat
      .removeGroup(chatId)
      .forEach((change) => this._gamePlayers.update(change));
  }

  private _removeGroupChatMember({
    chatId,
    player,
  }: {
    chatId: string;
    player: GroupChatPlayer;
  }): void {
    const change = this._chat.removeGroupMember(chatId, player);
    if (change) this._gamePlayers.update(change);
  }

  applyIncomingPlayerSwap(payload: unknown): void {
    if (
      Array.isArray(payload) &&
      payload.length === 2 &&
      payload.every((value) => typeof value === "number")
    ) {
      this._gamePlayers.swap(payload as [number, number]);
    }
  }

  applyIncomingPlayerMove(payload: unknown): void {
    if (
      Array.isArray(payload) &&
      payload.length === 2 &&
      payload.every((value) => typeof value === "number")
    ) {
      this._gamePlayers.move(payload as [number, number]);
    }
  }

  applyIncomingPlayerRemove(payload: unknown): void {
    if (typeof payload === "number" && Number.isInteger(payload)) {
      this._gamePlayers.remove(payload);
    }
  }

  applyIncomingNomination(payload: unknown): void {
    if (!payload) {
      const entry = this._voting.createHistoryEntry(this._gamePlayers.players, {
        isVoteHistoryAllowed: this._voting.isVoteHistoryAllowed,
        isSpectator: this._identity.isSpectator,
      });
      if (entry) this._voting.addVotes(entry);
      this._voting.addVoteSelected(
        { selected: false, players: this._gamePlayers.players, save: true },
        {
          isVoteHistoryAllowed: this._voting.isVoteHistoryAllowed,
          isSpectator: this._identity.isSpectator,
        },
      );
    }
    this._setNomination({ nomination: payload as Nomination });
  }

  applyIncomingMarkedPlayer(payload: unknown): void {
    if (typeof payload === "number") this._setMarkedPlayer(payload);
  }

  applyIncomingNight(payload: unknown): void {
    if (typeof payload === "boolean") this._grimoire.toggle("isNight", payload);
  }

  applyIncomingVoteHistoryAllowed(payload: unknown): void {
    if (typeof payload === "boolean")
      this._voting.setVoteHistoryAllowed(payload);
  }

  applyIncomingVotingSpeed(payload: unknown): void {
    if (typeof payload === "number") this._voting.setVotingSpeed(payload);
  }

  applyIncomingVoteInProgress(payload: unknown): void {
    if (typeof payload === "boolean") this._voting.setVoteInProgress(payload);
  }

  clearIncomingVoteHistory(): void {
    this._voting.clearVoteHistory();
  }

  _sendQueue() {
    this._outboxController.flush();
  }

  _startSendQueue() {
    this._outboxController.start();
  }

  _stopSendQueue() {
    this._outboxController.stop();
  }

  getPendingMessageCount() {
    return this._outboxController.pendingCount;
  }

  /**
   *
   * @param id id for identifying and deleting the query
   */
  _deleteFromQueue(id: unknown): void {
    this._outboxController.acknowledge(id);
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
        ? this._identity.stId
        : message.params.receivingPlayerId;
    if (!receivingPlayerId) return;
    this._chat.addReceivedMessage({
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
      this._sendDirect("host", "getGamestate", this._identity.playerId);
      this._sendDirect("host", "getStId", this._identity.playerId);
      this.checkAllowJoin();
      if (
        this._identity.claimedSeat >= 0 &&
        !useAudioStore(pinia).listeningFrame &&
        !useAudioStore(pinia).isTalking
      ) {
        this._setTalking({
          seatNum: this._identity.claimedSeat,
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
        ? this._identity.playerId
        : Object.keys(this._players).length,
      "latency",
    ]);
    if (this._pingTimer !== null) clearTimeout(this._pingTimer);
    this._pingTimer = setTimeout(this._ping.bind(this), this._pingInterval);
    // if (this._identity.sessionId &&
    //   !this._isAlive && !this._connection.isReconnecting
    // ) {
    //   this._isAlive = true;
    //   this.connect(this._identity.sessionId);
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
      this._identity.setSessionId("");
      await this._alertPopup("无效的房间号！");
      return;
    }
    if (!this._identity.playerId) {
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
      this._identity.setPlayerId(playerId);
    }
    if (!this._identity.stSecret) {
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
      this._identity.setStSecret(stSecret);
    }
    this._pings = {};
    this._connection.setPlayerCount(0);
    this._connection.setPing(0);
    this._isSpectator = this._identity.isSpectator === true;
    if (this._identity.claimedSeat >= 0) {
      this._setTalking({
        seatNum: this._identity.claimedSeat,
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
    if (this._pingTimer !== null) clearTimeout(this._pingTimer);
    this._pingTimer = null;
    this._stopSendQueue();
    this._reconnect.cancel();
    if (this._joinTimeout !== null) clearTimeout(this._joinTimeout);
    if (this._hostTimeout !== null) clearTimeout(this._hostTimeout);
    this._joinTimeout = null;
    this._hostTimeout = null;
    if (this._socketClient.isConnected) {
      if (this._isSpectator) {
        this._sendDirect("host", "bye", this._identity.playerId);
      }
      this._socketClient.close(1000);
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
    this._request("checkAllowHost", this._identity.playerId);
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
        this._identity.setSessionId("");
        this._identity.setSpectator(false);
      }
    }, 6000);
  }

  /**
   * @param allow indicator to if hosting the channel is allowed
   */
  async _handleAllowHost(allow: unknown): Promise<void> {
    if (typeof allow !== "boolean") return;
    if (this._connection.isHostAllowed === true) return;
    if (this._hostTimeout !== null) clearTimeout(this._hostTimeout);
    this._hostTimeout = null;
    this._connection.setIsHostAllowed(allow ? allow : null);

    if (allow) {
      this.sendGamestate();
    } else {
      await this.showInputModal({
        inputType: "alert",
        inputModal: "text",
        inputData: {
          name: [`房间"${this._identity.sessionId}"已经存在说书人！`],
        },
      }).catch(() => {
        return null;
      });
      this._identity.setSessionId("");
      this._identity.setSpectator(false);
    }
  }

  /**
   * Send request to server to check if joining the channel is allowed (has a host).
   */
  checkAllowJoin(): void {
    if (this._connection.isJoinAllowed === true) return;
    this._request("checkAllowJoin", this._identity.playerId);
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
        this._identity.setSessionId("");
        this._identity.setSpectator(false);
      }
    }, 1000);
  }

  /**
   * @param allow indicator to if joining the session is allowed
   */
  async _handleAllowJoin(allow: unknown): Promise<void> {
    if (typeof allow !== "boolean") return;
    if (this._connection.isJoinAllowed === true) return;
    if (this._joinTimeout !== null) clearTimeout(this._joinTimeout);
    this._joinTimeout = null;
    this._connection.setIsJoinAllowed(allow ? allow : null);

    if (allow) {
      this._sendDirect("host", "getGamestate", this._identity.playerId);
      this._sendDirect("host", "getStId", this._identity.playerId);
    } else {
      await this.showInputModal({
        inputType: "alert",
        inputModal: "text",
        inputData: {
          name: [`房间"${this._identity.sessionId}"不存在！`],
        },
      }).catch(() => {
        return null;
      });
      this._identity.setSessionId("");
      this._identity.setSpectator(false);
    }
  }

  /**
   * Publish the current gamestate.
   * Optional param to reduce traffic. (send only player data)
   * @param playerId
   * @param isLightweight
   */
  sendGamestate(playerId = "", isLightweight = false) {
    this._gameStateController.sendGamestate(playerId, isLightweight);
  }
  _updateGamestate(data: LegacyGameStatePayload): void {
    this._gameStateController._updateGamestate(data);
  }
  sendStId(playerId = "") {
    this._gameStateController.sendStId(playerId);
  }
  _updateStId(data: string): void {
    this._gameStateController._updateStId(data);
  }
  sendEdition(playerId = "") {
    this._gameStateController.sendEdition(playerId);
  }
  _updateEdition(payload: LegacyEditionPayload) {
    return this._gameStateController._updateEdition(payload);
  }
  sendStates(playerId = "") {
    this._gameStateController.sendStates(playerId);
  }
  _updateStates(states: unknown[]) {
    this._gameStateController._updateStates(states);
  }
  sendTeamsNames(playerId = "") {
    this._gameStateController.sendTeamsNames(playerId);
  }
  _updateTeamsNames(teamsNames: Record<string, string>) {
    this._gameStateController._updateTeamsNames(teamsNames);
  }
  sendFirstNight(playerId = "") {
    this._gameStateController.sendFirstNight(playerId);
  }
  _updateFirstNight(firstNight: string[]) {
    this._gameStateController._updateFirstNight(firstNight);
  }
  sendOtherNight(playerId = "") {
    this._gameStateController.sendOtherNight(playerId);
  }
  _updateOtherNight(otherNight: string[]) {
    this._gameStateController._updateOtherNight(otherNight);
  }
  sendFabled() {
    this._gameStateController.sendFabled();
  }
  _updateFabled(fabled: LegacyRuntimeRole[]) {
    this._gameStateController._updateFabled(fabled);
  }

  sendPlayer(payload: PlayerUpdatePayload) {
    this._playerController.sendPlayer(payload);
  }
  _updatePlayer(payload: { index: number; property: string; value: unknown }) {
    this._playerController._updatePlayer(payload);
  }
  emptyPlayer(payload: { id: string }) {
    this._playerController.emptyPlayer(payload);
  }
  _updateLeaveSeat() {
    this._playerController._updateLeaveSeat();
  }
  sendPlayerPronouns(payload: PlayerPronounsPayload) {
    this._playerController.sendPlayerPronouns(payload);
  }
  _updatePlayerPronouns(payload: [number, string]): void {
    this._playerController._updatePlayerPronouns(payload);
  }
  setIsRole(payload: LegacyRoleActivityPayload): void {
    this._playerController.setIsRole(payload);
  }
  _updateIsRole(payload: LegacyRoleActivityPayload): void {
    this._playerController._updateIsRole(payload);
  }
  _updateUsingRole(payload: LegacyUsingRolePayload): void {
    this._playerController._updateUsingRole(payload);
  }
  uploadAvatar(image: string) {
    this._playerController.uploadAvatar(image);
  }
  _avatarReceived(link: string): Promise<void> {
    return this._playerController._avatarReceived(link);
  }

  /**
   * Handle a ping message by another player / storyteller
   * @param playerIdOrCount
   * @param latency
   * @private
   */
  _handlePing([playerIdOrCount = 0, latency]: LegacyPingPayload = []): void {
    const now = new Date().getTime();
    // if (!this._players.length) return;
    if (!this._isSpectator) {
      // store new player data
      if (playerIdOrCount) {
        this._players[String(playerIdOrCount)] = now;
        const ping = Number(latency);
        if (ping && ping > 0 && ping < 30 * 1000) {
          // ping to Players
          this._pings[String(playerIdOrCount)] = ping;
          const pings = Object.values(this._pings);
          this._connection.setPing(
            Math.round(pings.reduce((a, b) => a + b, 0) / pings.length),
          );
        }
      }
    } else if (latency !== undefined) {
      // ping to ST
      this._connection.setPing(Number(latency));
    }
    // update player count
    if (!this._isSpectator || playerIdOrCount) {
      const playerCount = this._isSpectator
        ? Number(playerIdOrCount)
        : Object.keys(this._players).length;
      if (Number.isFinite(playerCount))
        this._connection.setPlayerCount(playerCount);
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
    this._seatController.claimSeat(seat);
  }

  /**
   * Update a player id associated with that seat.
   * @param index seat index or -1
   * @param value playerId to add / remove
   * @private
   */
  _updateSeat([index, value, name, image]: LegacyClaimPayload): void {
    this._seatController.updateSeat([index, value, name, image]);
    if (!this._isSpectator) this.sendGamestate();
  }

  /**
   * Create a chat history for a playerID.
   * @param index seat index (only created when seat claimed but not removed)
   * @param value playerId to add
   * @private
   */
  _createChatHistory(payload: LegacyClaimPayload): void {
    this._seatController.createChatHistory(payload);
  }

  /**
   * Distribute player roles to all seated players in a direct message.
   * This will be split server side so that each player only receives their own (sub)message.
   */
  distributeRoles() {
    this._playerDeliveryController.distributeRoles();
  }
  distributeTypes() {
    this._playerDeliveryController.distributeTypes();
  }
  distributeBluffs(payload: TargetedDistribution): void {
    this._playerDeliveryController.distributeBluffs(payload);
  }
  _updateBluff(bluffs: LegacyRuntimeRole[]) {
    this._playerDeliveryController._updateBluff(bluffs);
  }
  distributeGrimoire(payload: TargetedDistribution): void {
    this._playerDeliveryController.distributeGrimoire(payload);
  }
  _updateGrimoire(payload: LegacyGrimoirePayload): void {
    this._playerDeliveryController._updateGrimoire(payload);
  }

  nomination(payload: NominationPayload) {
    this._votingController.nomination(payload);
  }
  setVoteInProgress() {
    this._votingController.setVoteInProgress();
  }
  setIsNight() {
    this._votingController.setIsNight();
  }
  setVoteHistoryAllowed() {
    this._votingController.setVoteHistoryAllowed();
  }
  setVotingSpeed(votingSpeed: number) {
    this._votingController.setVotingSpeed(votingSpeed);
  }
  setMarked(playerIndex: number) {
    this._votingController.setMarked(playerIndex);
  }
  clearVoteHistory() {
    this._votingController.clearVoteHistory();
  }
  vote(payload: [number]) {
    this._votingController.vote(payload);
  }
  setSecretVote(isSecretVote: boolean) {
    this._votingController.setSecretVote(isSecretVote);
  }
  _handleSecretVote(isSecretVote: boolean): void {
    this._votingController._handleSecretVote(isSecretVote);
  }
  setBootlegger(content: string) {
    this._votingController.setBootlegger(content);
  }
  _handleSetBootlegger(content: string): void {
    this._votingController._handleSetBootlegger(content);
  }
  setUseOldOrder(isUseOldOrder: UseOldOrder) {
    this._votingController.setUseOldOrder(isUseOldOrder);
  }
  _handleSetUseOldOrder(isUseOldOrder: UseOldOrder): void {
    this._votingController._handleSetUseOldOrder(isUseOldOrder);
  }
  setUseOldRole(isUseOldRole: UseOldRole) {
    this._votingController.setUseOldRole(isUseOldRole);
  }
  _handleSetUseOldRole(isUseOldRole: UseOldRole): void {
    this._votingController._handleSetUseOldRole(isUseOldRole);
  }
  setIsReview(isReview: boolean) {
    this._votingController.setIsReview(isReview);
  }
  _handleSetIsReview(isReview: boolean): void {
    this._votingController._handleSetIsReview(isReview);
  }
  setTalking(payload: unknown): void {
    this._votingController.setTalking(payload);
  }
  _handleSetTalking(payload: LegacySetTalkingPayload): void {
    this._votingController._handleSetTalking(payload);
  }
  _handleVote(payload: [number, boolean | number | null, boolean]) {
    this._votingController._handleVote(payload);
  }
  lockVote() {
    this._votingController.lockVote();
  }
  _handleLock(payload: [number, boolean | number | null]) {
    this._votingController._handleLock(payload);
  }

  swapPlayer(payload: [number, number]) {
    if (this._isSpectator) return;
    this._send("swap", payload);
  }

  /**
   * Move a player to another seat. ST only
   * @param payload
   */
  movePlayer(payload: [number, number]) {
    if (this._isSpectator) return;
    this._send("move", payload);
  }

  /**
   * Remove a player. ST only
   * @param payload
   */
  removePlayer(payload: number) {
    if (this._isSpectator) return;
    this._send("remove", payload);
  }

  /**
   * Create a group chat. ST only
   * @param chatId id of the chat group
   * @param players players within each chat group
   */
  sendAddGroupChat(payload: unknown) {
    this._chatController.sendAddGroupChat(payload);
  }

  sendRemoveGroupChat(payload: { playerIds?: string[] }) {
    this._chatController.sendRemoveGroupChat(payload);
  }

  sendRemoveGroupChatMember(payload: {
    chatId: string;
    player: LegacyRuntimePlayer;
  }) {
    this._chatController.sendRemoveGroupChatMember(payload);
  }

  _handleChat(
    payload: LegacyChatPayload,
    feedback: LegacyFeedback | null | undefined,
  ): void {
    this._chatController._handleChat(payload, feedback);
  }

  _handleAddGroupChat(
    playerIds: string[],
    feedback: LegacyFeedback | null = false,
  ): void {
    this._chatController._handleAddGroupChat(playerIds, feedback);
  }

  _handleRemoveGroupChat(feedback: LegacyFeedback | null = false): void {
    this._chatController._handleRemoveGroupChat(feedback);
  }

  _handleRemoveGroupChatMember(
    playerId: string,
    feedback: LegacyFeedback | null = false,
  ): void {
    this._chatController._handleRemoveGroupChatMember(playerId, feedback);
  }

  _handleSyncPlayerStatus(payload: LegacySessionStatusPayload): void {
    this._chatController._handleSyncPlayerStatus(payload);
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
    this._timer.setTimer(time);
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
    this._timer.startTimer(payload);
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
    this._timer.stopTimer();
  }
}

export default () => {
  // lobby
  const lobby = new LiveLobby();
  if (window.location.pathname === "/") lobby.connect();
  // setup
  const session = new LiveSession();

  gameEvents.subscribe((mutation) => {
    const state = { session: useSessionIdentityStore(pinia).$state };
    if (!isSessionOutboundState(state)) return;
    dispatchSessionMutation(session, mutation, state);
  });
};
