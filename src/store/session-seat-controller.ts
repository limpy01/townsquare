import type { LegacyClaimPayload } from "@townsquare/contracts/legacy-client-command";
import { pinia } from "../pinia";
import { useChatStore } from "../stores/chat";
import { usePlayersStore } from "../stores/players";
import { useProfileStore } from "../stores/profile";
import { useSessionIdentityStore } from "../stores/session-identity";

type GroupChatPlayer = {
  id: string;
  name?: string;
};

type SessionSeatControllerOptions = {
  isSpectator: () => boolean;
  sendDirect: (
    playerId: string | null | undefined,
    command: string,
    params: unknown,
  ) => void;
  recordPing: (payload: [boolean, string, number]) => void;
  removeGroupChatMember: (payload: {
    chatId: string;
    player: GroupChatPlayer;
  }) => void;
};

export class SessionSeatController {
  private readonly _isSpectator: () => boolean;
  private readonly _sendDirect: SessionSeatControllerOptions["sendDirect"];
  private readonly _recordPing: SessionSeatControllerOptions["recordPing"];
  private readonly _removeGroupChatMember: SessionSeatControllerOptions["removeGroupChatMember"];
  private readonly _chat = useChatStore(pinia);
  private readonly _identity = useSessionIdentityStore(pinia);
  private readonly _gamePlayers = usePlayersStore(pinia);
  private readonly _profile = useProfileStore(pinia);

  constructor(options: SessionSeatControllerOptions) {
    this._isSpectator = options.isSpectator;
    this._sendDirect = options.sendDirect;
    this._recordPing = options.recordPing;
    this._removeGroupChatMember = options.removeGroupChatMember;
  }

  claimSeat(seat: unknown): void {
    if (!this._isSpectator()) return;
    if (typeof seat !== "number" || !Number.isInteger(seat) || seat < -1)
      return;
    const players = this._gamePlayers.players;
    const targetPlayer = seat >= 0 ? players[seat] : undefined;
    if (players.length > seat && (seat < 0 || !targetPlayer?.id)) {
      this._sendDirect("host", "claim", [
        seat,
        this._identity.playerId,
        this._profile.playerName,
        this._profile.playerAvatar,
      ]);
    }
  }

  updateSeat([index, value, name, image]: LegacyClaimPayload): void {
    if (this._isSpectator()) return;
    const players = this._gamePlayers.players;
    const claimedPlayer = index >= 0 ? players[index] : undefined;
    if (claimedPlayer?.id) return;
    const oldIndex = players.findIndex(({ id }) => id === value);
    if (oldIndex >= 0 && oldIndex !== index) {
      const oldPlayer = players[oldIndex];
      if (!oldPlayer) return;
      if (oldPlayer.chatGroup != "") {
        this._removeGroupChatMember({
          chatId: oldPlayer.chatGroup,
          player: oldPlayer,
        });
      }
      this._gamePlayers.update({
        player: oldPlayer,
        property: "id",
        value: "",
      });
      if (oldPlayer.isTalking === true) {
        this._gamePlayers.update({
          player: oldPlayer,
          property: "isTalking",
          value: false,
        });
      }
      if (oldPlayer.isWraith === true) {
        this._gamePlayers.update({
          player: oldPlayer,
          property: "isWraith",
          value: false,
        });
      }
      if (oldPlayer.isUsingWraith === true) {
        this._gamePlayers.update({
          player: oldPlayer,
          property: "isUsingWraith",
          value: false,
        });
      }
      if (oldPlayer.isAllowRole === false) {
        this._gamePlayers.update({
          player: oldPlayer,
          property: "isAllowRole",
          value: true,
        });
      }
    }
    if (index >= 0) {
      const player = players[index];
      if (!player) return;
      this._gamePlayers.update({ player, property: "image", value: image });
      this._gamePlayers.update({ player, property: "name", value: name });
      this._gamePlayers.update({ player, property: "id", value });
    }
    this._recordPing([true, value, 0]);
  }

  createChatHistory([index]: LegacyClaimPayload): void {
    if (index < 0) return;
    const player = this._gamePlayers.players[index];
    if (!player) return;
    const playerId = player.id;
    if (playerId === "") return;
    if (this._chat.histories.some((history) => history.id === playerId)) return;
    if (this._isSpectator() && this._identity.playerId != playerId) return;
    this._chat.createHistory(playerId);
  }
}
