import type {
  LegacyRoleActivityPayload,
  LegacySetTalkingPayload,
} from "@townsquare/contracts/legacy-client-command";
import type { LegacyFeedback } from "@townsquare/contracts/legacy-envelope";
import { pinia } from "../pinia";
import { useGrimoireStore } from "../stores/grimoire";
import {
  useLegacyOptionsStore,
  type UseOldOrder,
  type UseOldRole,
} from "../stores/legacy-options";
import { usePlayersStore } from "../stores/players";
import { useReviewStore } from "../stores/review";
import { useRoleActivityStore } from "../stores/role-activity";
import { useSessionIdentityStore } from "../stores/session-identity";
import { useSessionSettingsStore } from "../stores/session-settings";
import { useVotingStore, type Nomination } from "../stores/voting";
import {
  isTimerSeconds,
  parseSetTalkingPayload,
} from "./session-transport-guards";

type NominationPayload =
  | Nomination
  | { nomination?: Nomination | undefined }
  | null
  | undefined;
type VoteControllerOptions = {
  isSpectator: () => boolean;
  send: (command: string, params: unknown, feedback?: LegacyFeedback) => void;
  sendDirect: (
    playerId: string | null | undefined,
    command: string,
    params: unknown,
    feedback?: LegacyFeedback,
  ) => void;
};

export class SessionVotingController {
  private readonly _isSpectator: () => boolean;
  private readonly _send: VoteControllerOptions["send"];
  private readonly _sendDirect: VoteControllerOptions["sendDirect"];
  private readonly _gamePlayers = usePlayersStore(pinia);
  private readonly _grimoire = useGrimoireStore(pinia);
  private readonly _identity = useSessionIdentityStore(pinia);
  private readonly _legacyOptions = useLegacyOptionsStore(pinia);
  private readonly _review = useReviewStore(pinia);
  private readonly _roles = useRoleActivityStore(pinia);
  private readonly _settings = useSessionSettingsStore(pinia);
  private readonly _voting = useVotingStore(pinia);

  constructor(options: VoteControllerOptions) {
    this._isSpectator = options.isSpectator;
    this._send = options.send;
    this._sendDirect = options.sendDirect;
  }

  nomination(payload: NominationPayload) {
    if (this._isSpectator()) return;
    const nomination = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object"
      ? payload.nomination
      : undefined;
    const players = this._gamePlayers.players;
    if (
      !nomination ||
      (players.length > nomination[0] && players.length > nomination[1])
    ) {
      this.setVotingSpeed(this._voting.votingSpeed);
      this._send("nomination", nomination ?? null);
    }
  }

  /**
   * Set the isVoteInProgress status. ST only
   */
  setVoteInProgress() {
    if (this._isSpectator()) return;
    this._send("isVoteInProgress", this._voting.isVoteInProgress);
  }

  /**
   * Send the isNight status. ST only
   */
  setIsNight() {
    if (this._isSpectator()) return;
    this._send("isNight", this._grimoire.isNight);
  }

  /**
   * Send the isVoteHistoryAllowed state. ST only
   */
  setVoteHistoryAllowed() {
    if (this._isSpectator()) return;
    this._send("isVoteHistoryAllowed", this._voting.isVoteHistoryAllowed);
  }

  /**
   * Send the voting speed. ST only
   * @param votingSpeed voting speed in seconds, minimum 1
   */
  setVotingSpeed(votingSpeed: number) {
    if (this._isSpectator()) return;
    if (votingSpeed) {
      this._send("votingSpeed", votingSpeed);
    }
  }

  /**
   * Set which player is on the block. ST only
   * @param playerIndex, player id or -1 for empty
   */
  setMarked(playerIndex: number) {
    if (this._isSpectator()) return;
    if (this._voting.isSecretVote) return;
    this._send("marked", playerIndex);
  }

  /**
   * Clear the vote history for everyone. ST only
   */
  clearVoteHistory() {
    if (this._isSpectator()) return;
    this._send("clearVoteHistory", undefined);
  }

  /**
   * Send a vote. Player or ST
   * @param index Seat of the player
   * @param sync Flag whether to sync this vote with others or not
   */
  vote([index]: [number]) {
    const nomination = this._voting.nomination;
    if (!nomination) return;
    const player = this._gamePlayers.players[index];
    if (!player) return;
    if (this._identity.playerId === player.id || !this._isSpectator()) {
      if (
        this._gamePlayers.players[nomination[1]]?.role.team === "traveler" ||
        !this._voting.isSecretVote
      ) {
        // send to everyone if exile or secret vote is off
        // send vote only if it is your own vote or you are the storyteller
        this._send("vote", [
          index,
          this._voting.votes[index],
          !this._isSpectator(),
        ]);
      } else {
        // otherwise only send direct messages
        if (this._isSpectator()) {
          this._sendDirect("host", "vote", [
            index,
            this._voting.votes[index],
            !this._isSpectator(),
          ]);
        } else {
          this._sendDirect(player.id, "vote", [
            index,
            this._voting.votes[index],
            !this._isSpectator(),
          ]);
        }
      }
    }
  }

  /**
   * Send a status change to whether anonymous votes are in progress. ST to players only
   */
  setSecretVote(isSecretVote: boolean) {
    if (this._isSpectator()) return;
    this._send("secretVote", isSecretVote);
  }

  _handleSecretVote(isSecretVote: boolean): void {
    if (!this._isSpectator()) return;
    this._voting.setSecretVote(isSecretVote);
  }

  setBootlegger(content: string) {
    if (this._isSpectator()) return;
    this._send("bootlegger", content);
  }

  _handleSetBootlegger(content: string): void {
    if (!this._isSpectator()) return;
    this._settings.setBootlegger(content);
  }

  setUseOldOrder(isUseOldOrder: UseOldOrder) {
    if (this._isSpectator()) return;
    this._send("useOldOrder", isUseOldOrder);
  }

  _handleSetUseOldOrder(isUseOldOrder: UseOldOrder): void {
    if (!this._isSpectator()) return;
    this._legacyOptions.setUseOldOrder(isUseOldOrder);
  }

  setUseOldRole(isUseOldRole: UseOldRole) {
    if (this._isSpectator()) return;
    this._send("useOldRole", isUseOldRole);
  }

  _handleSetUseOldRole(isUseOldRole: UseOldRole): void {
    if (!this._isSpectator()) return;
    this._legacyOptions.setUseOldRole(isUseOldRole);
  }

  setIsReview(isReview: boolean) {
    if (this._isSpectator()) return;
    this._send("isReview", isReview);
  }

  _handleSetIsReview(isReview: boolean): void {
    if (!this._isSpectator()) return;
    this._review.setReview(isReview);
    if (!isReview) {
      this._gamePlayers.players.forEach((player) => {
        this._gamePlayers.update({
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
      talkingPayload.seatNum >= this._gamePlayers.players.length
    )
      return;
    const player = this._gamePlayers.players[talkingPayload.seatNum];
    if (!player?.id || player.id != this._identity.playerId) return;
    this._send("setTalking", talkingPayload);
  }

  /**
   * Set talking status to true to enable glowing animation when received
   */
  _handleSetTalking(payload: LegacySetTalkingPayload): void {
    if (
      payload.seatNum < 0 ||
      payload.seatNum >= this._gamePlayers.players.length
    )
      return;
    const player = this._gamePlayers.players[payload.seatNum];
    if (player) player.isTalking = payload.isTalking;
  }

  /**
   * Handle an incoming vote, but only if it is from ST or unlocked.
   * @param index
   * @param vote
   * @param fromST
   */
  _handleVote([index, vote, fromST]: [
    number,
    boolean | number | null,
    boolean,
  ]) {
    // do not reveal vote when anonymous voting is in progress, unless it's ST changing that player's vote
    const voter = this._gamePlayers.players[index];
    const nomination = this._voting.nomination;
    if (!nomination) return;
    const nominatedPlayer = this._gamePlayers.players[nomination[1]];
    if (!voter || !nominatedPlayer) return;
    const voteId = voter.id;
    if (
      this._isSpectator() &&
      voteId != this._identity.playerId &&
      this._voting.isSecretVote &&
      nominatedPlayer.role.team != "traveler"
    )
      return;

    const { players } = this._gamePlayers;
    const voting = this._voting;
    const playerCount = players.length;
    if (!playerCount) return;
    const indexAdjusted =
      (index - 1 + playerCount - nomination[1]) % playerCount;
    if (fromST || indexAdjusted >= voting.lockedVote - 1) {
      this._voting.vote([index, vote ?? undefined]);
    }
  }

  /**
   * Lock a vote. ST only
   */
  lockVote() {
    if (this._isSpectator()) return;
    const { lockedVote, votes, nomination } = this._voting;
    if (!nomination) return;
    const { players } = this._gamePlayers;
    if (!players.length) return;
    const index = (nomination[1] + lockedVote - 1) % players.length;
    this._send("lock", [this._voting.lockedVote, votes[index]]);
  }

  /**
   * Update vote lock and the locked vote, if it differs. Player only
   * @param lock
   * @param vote
   * @private
   */
  _handleLock([lock, vote]: [number, boolean | number | null]) {
    if (!this._isSpectator()) return;
    this._voting.lockVote(lock);

    if (lock > 1) {
      const { lockedVote, nomination } = this._voting;
      if (!nomination) return;
      const { players } = this._gamePlayers;
      if (!players.length) return;
      const index = (nomination[1] + lockedVote - 1) % players.length;
      // record as not voted when anonymous voting is in progress
      const displayVote = this._voting.isSecretVote ? false : vote;
      if (this._voting.votes[index] !== vote) {
        this._voting.vote([index, displayVote ?? undefined]);
      }
    }
  }

  /**
   * Swap two player seats. ST only
   * @param payload
   */
}
