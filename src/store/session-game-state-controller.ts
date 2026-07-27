import type { LegacyGameStatePayload } from "@townsquare/contracts/legacy-client-command";
import type { LegacyFeedback } from "@townsquare/contracts/legacy-envelope";
import { pinia } from "../pinia";
import { showInputModal } from "../services/input-modal";
import type { InputModalRequest } from "../stores/input";
import { useGrimoireStore } from "../stores/grimoire";
import { useChatStore } from "../stores/chat";
import {
  useLegacyOptionsStore,
  type UseOldOrder,
  type UseOldRole,
} from "../stores/legacy-options";
import { useModalStore } from "../stores/modals";
import { usePlayersStore } from "../stores/players";
import { useReviewStore } from "../stores/review";
import { useScenarioStore } from "../stores/scenario";
import { useSessionIdentityStore } from "../stores/session-identity";
import { useVotingStore, type Nomination } from "../stores/voting";
import { getCustomRolesStripped, rolesJSONbyId } from "./selectors";
import {
  gameStatePlayerProperties,
  type LegacyRuntimeRole,
} from "./session-transport-guards";

type GameStateControllerOptions = {
  isSpectator: () => boolean;
  send: (command: string, params: unknown, feedback?: LegacyFeedback) => void;
  sendDirect: (
    playerId: string | null | undefined,
    command: string,
    params: unknown,
    feedback?: LegacyFeedback,
  ) => void;
  distributeGrimoire: (payload: { playerId?: string; all?: boolean }) => void;
  showInputModal: (
    request: InputModalRequest,
  ) => ReturnType<typeof showInputModal>;
};
type LegacyEditionPayload = {
  edition: { id: string; isOfficial: boolean; [key: string]: unknown };
  roles?: LegacyRuntimeRole[];
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isVoteValue = (value: unknown): value is boolean | number | undefined =>
  typeof value === "boolean" ||
  typeof value === "number" ||
  value === undefined;

export class SessionGameStateController {
  private readonly _isSpectator: () => boolean;
  private readonly _send: GameStateControllerOptions["send"];
  private readonly _sendDirect: GameStateControllerOptions["sendDirect"];
  private readonly _distributeGrimoire: GameStateControllerOptions["distributeGrimoire"];
  private readonly _showInputModal: GameStateControllerOptions["showInputModal"];
  private readonly _grimoire = useGrimoireStore(pinia);
  private readonly _chat = useChatStore(pinia);
  private readonly _identity = useSessionIdentityStore(pinia);
  private readonly _legacyOptions = useLegacyOptionsStore(pinia);
  private readonly _modals = useModalStore(pinia);
  private readonly _gamePlayers = usePlayersStore(pinia);
  private readonly _review = useReviewStore(pinia);
  private readonly _scenario = useScenarioStore(pinia);
  private readonly _voting = useVotingStore(pinia);
  private _gamestate: Array<Record<string, unknown>> = [];

  get gamestate(): Array<Record<string, unknown>> {
    return this._gamestate;
  }

  constructor(options: GameStateControllerOptions) {
    this._isSpectator = options.isSpectator;
    this._send = options.send;
    this._sendDirect = options.sendDirect;
    this._distributeGrimoire = options.distributeGrimoire;
    this._showInputModal = options.showInputModal;
  }

  private _setNomination(payload: unknown): void {
    this._voting.setNomination(payload as never, {
      isSecretVote: this._voting.isSecretVote,
      claimedSeat: this._identity.claimedSeat,
    });
  }
  private _setMarkedPlayer(
    payload: number | { val?: number; force?: boolean },
  ): void {
    this._voting.setMarkedPlayer(payload, {
      isSecretVote: this._voting.isSecretVote,
    });
  }

  sendGamestate(playerId = "", isLightweight = false) {
    if (this._isSpectator()) return;
    this._gamestate = this._gamePlayers.players.map((player) => ({
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
      const { isNight } = this._grimoire;
      const { states, teamsNames, firstNight, otherNight } = this._scenario;
      const voting = this._voting;
      const { fabled } = this._gamePlayers;
      this.sendEdition(playerId);
      let votes = voting.nomination ? Array.from(voting.votes) : []; // 调整闭眼投票，只会发送各玩家自己的真实投票情况，其余均为不投票
      if (voting.isSecretVote && playerId === "") {
        votes = [];
      } else if (voting.isSecretVote && votes.length > 0) {
        const playerIndex = this._gamePlayers.players.findIndex(
          (player) => player.id === playerId,
        );
        for (let i = 0; i < votes.length; i++) {
          // 如果不与playerIndex相同则调整至不投票状态
          if (i != playerIndex && votes[i] === true) votes[i] = false;
        }
      }
      this._sendDirect(playerId, "gs", {
        gamestate: this._gamestate,
        isNight,
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
      this._distributeGrimoire(playerId ? { playerId } : { all: true });
    }

    // 场内玩家更新
    const playerIndex = !playerId
      ? -1
      : this._gamePlayers.players.findIndex((player) => player.id === playerId);
    const groups: Record<string, string[]> = {};
    if (!playerId || playerIndex > -1) {
      const selectedPlayers = !playerId
        ? this._gamePlayers.players.filter((player) => !!player.id)
        : (() => {
            const player = this._gamePlayers.players[playerIndex];
            return player ? [player] : [];
          })();

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
    if (!this._isSpectator()) return;
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
    const players = this._gamePlayers.players;
    // adjust number of players
    if (players.length < gamestate.length) {
      for (let x = players.length; x < gamestate.length; x++) {
        const incomingPlayer = gamestate[x];
        if (incomingPlayer) this._gamePlayers.add(incomingPlayer.name);
      }
    } else if (players.length > gamestate.length) {
      for (let x = players.length; x > gamestate.length; x--) {
        this._gamePlayers.remove(x - 1);
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
              this._gamePlayers.update({ player, property, value });
          } else {
            this._gamePlayers.update({ player, property, value });
          }
        }
      });
      // roles are special, because of travelers
      if (roleId && player.role.id !== roleId) {
        const role =
          this._scenario.roles.get(roleId) || rolesJSONbyId.get(roleId);
        if (role) {
          this._gamePlayers.update({
            player,
            property: "role",
            value: role,
          });
        }
      } else if (!roleId && player.role.team === "traveler") {
        this._gamePlayers.update({
          player,
          property: "role",
          value: {},
        });
      }
    });
    if (!isLightweight) {
      this._grimoire.toggle("isNight", !!isNight);
      if (typeof isVoteHistoryAllowed === "boolean")
        this._voting.setVoteHistoryAllowed(isVoteHistoryAllowed);
      if (typeof isSecretVote === "boolean")
        this._voting.setSecretVote(isSecretVote);
      if (isRecord(isUseOldOrder))
        this._legacyOptions.setUseOldOrder(isUseOldOrder as UseOldOrder);
      if (isRecord(isUseOldRole))
        this._legacyOptions.setUseOldRole(isUseOldRole as UseOldRole);
      if (typeof isReview === "boolean") this._review.setReview(isReview);
      const nominatedPlayer =
        Array.isArray(nomination) && nomination.length > 1
          ? players[Number(nomination[1])] ?? null
          : null;
      this._setNomination({
        nomination,
        votes: Array.isArray(votes) ? votes.filter(isVoteValue) : [],
        votingSpeed: typeof votingSpeed === "number" ? votingSpeed : undefined,
        lockedVote,
        isVoteInProgress,
        nominatedPlayer,
      });
      this._setMarkedPlayer(
        typeof markedPlayer === "number"
          ? { val: markedPlayer, force: false }
          : { force: false },
      );
      this._gamePlayers.setFabled({ fabled });
      if (Array.isArray(states)) this._scenario.setStates(states);
      if (isRecord(teamsNames)) {
        this._scenario.setTeamsNames(
          Object.fromEntries(
            Object.entries(teamsNames).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string",
            ),
          ),
        );
      }
      if (Array.isArray(firstNight)) this._scenario.setFirstNight(firstNight);
      if (Array.isArray(otherNight)) this._scenario.setOtherNight(otherNight);
    }
  }

  sendStId(playerId = "") {
    if (this._isSpectator()) return;
    this._sendDirect(playerId, "stId", this._identity.playerId);
  }

  _updateStId(data: string): void {
    if (!this._isSpectator()) return;
    // this._identity.stId = data;
    this._identity.setStId(data);
  }

  /**
   * Publish an edition update. ST only
   * @param playerId
   */
  sendEdition(playerId = "") {
    if (this._isSpectator()) return;
    const { edition } = this._scenario;
    let roles;
    if (!edition.isOfficial) {
      roles = getCustomRolesStripped(this._scenario.roles.values());
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
  async _updateEdition({ edition, roles }: LegacyEditionPayload) {
    if (!this._isSpectator()) return;
    this._scenario.setEdition(edition);
    if (roles) {
      this._scenario.setCustomRoles(roles);
      if (this._scenario.roles.size !== roles.length) {
        const missing: string[] = [];
        roles.forEach(({ id }) => {
          if (!this._scenario.roles.get(id)) {
            missing.push(id);
          }
        });
        await this._showInputModal({
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
        this._modals.toggle("edition");
      }
    }
  }

  /**
   * Publish a states update. ST only
   * @param playerId
   */
  sendStates(playerId = "") {
    if (this._isSpectator()) return;
    const { states } = this._scenario;
    this._sendDirect(playerId, "states", states);
  }

  /**
   * Update states for custom editions.
   * @param states
   * @private
   */
  _updateStates(states: unknown[]) {
    if (!this._isSpectator()) return;
    this._scenario.setStates(states);
  }

  /**
   * Publish a teams alias update. ST only
   * @param playerId
   */
  sendTeamsNames(playerId = "") {
    if (this._isSpectator()) return;
    const { teamsNames } = this._scenario;
    this._sendDirect(playerId, "teamsNames", teamsNames);
  }

  /**
   * Update teamsNames for custom editions.
   * @param teamsNames
   * @private
   */
  _updateTeamsNames(teamsNames: Record<string, string>) {
    if (!this._isSpectator()) return;
    this._scenario.setTeamsNames(teamsNames);
  }

  /**
   * Publish a firstNight update. ST only
   * @param playerId
   */
  sendFirstNight(playerId = "") {
    if (this._isSpectator()) return;
    const { firstNight } = this._scenario;
    this._sendDirect(playerId, "firstNight", firstNight);
  }

  /**
   * Update firstNight.
   * @param firstNight
   * @private
   */
  _updateFirstNight(firstNight: string[]) {
    if (!this._isSpectator()) return;
    this._scenario.setFirstNight(firstNight);
  }

  /**
   * Publish an otherNight update. ST only
   * @param playerId
   */
  sendOtherNight(playerId = "") {
    if (this._isSpectator()) return;
    const { otherNight } = this._scenario;
    this._sendDirect(playerId, "otherNight", otherNight);
  }

  /**
   * Update otherNight.
   * @param otherNight
   * @private
   */
  _updateOtherNight(otherNight: string[]) {
    if (!this._isSpectator()) return;
    this._scenario.setOtherNight(otherNight);
  }

  /**
   * Publish a fabled update. ST only
   */
  sendFabled() {
    if (this._isSpectator()) return;
    const { fabled } = this._gamePlayers;
    this._send("fabled", fabled);
  }

  /**
   * Update fabled roles.
   * @param fabled
   * @private
   */
  _updateFabled(fabled: LegacyRuntimeRole[]) {
    if (!this._isSpectator()) return;
    this._gamePlayers.setFabled({
      fabled,
    });
  }

  /**
   * Publish a player update.
   * @param player
   * @param property
   * @param value
   */
}
