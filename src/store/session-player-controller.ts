import type {
  LegacyRoleActivityPayload,
  LegacyUsingRolePayload,
} from "@townsquare/contracts/legacy-client-command";
import type { LegacyFeedback } from "@townsquare/contracts/legacy-envelope";
import { pinia } from "../pinia";
import { showInputModal } from "../services/input-modal";
import type { InputModalRequest } from "../stores/input";
import { usePlayersStore } from "../stores/players";
import { useProfileStore } from "../stores/profile";
import { useReviewStore } from "../stores/review";
import {
  useRoleActivityStore,
  type WraithProperty,
} from "../stores/role-activity";
import { useScenarioStore } from "../stores/scenario";
import { useSessionIdentityStore } from "../stores/session-identity";
import { rolesJSONbyId } from "./selectors";
import { isLegacyRuntimeRole } from "./session-transport-guards";

type RuntimePlayer = { id: string; [key: string]: unknown };
type PlayerUpdatePayload = {
  player: RuntimePlayer;
  property: string;
  value: unknown;
};
type PlayerPronounsPayload = {
  player: RuntimePlayer;
  value: string;
  isFromSockets: boolean;
};
type PlayerControllerOptions = {
  isSpectator: () => boolean;
  send: (command: string, params: unknown, feedback?: LegacyFeedback) => void;
  sendDirect: (
    playerId: string | null | undefined,
    command: string,
    params: unknown,
    feedback?: LegacyFeedback,
  ) => void;
  uploadFile: (
    command: string,
    playerId: string | null | undefined,
    params: unknown,
    feedback?: LegacyFeedback,
  ) => void;
  showInputModal: (
    request: InputModalRequest,
  ) => ReturnType<typeof showInputModal>;
  gamestate: () => Array<Record<string, unknown>>;
};

export class SessionPlayerController {
  private readonly _isSpectator: () => boolean;
  private readonly _send: PlayerControllerOptions["send"];
  private readonly _sendDirect: PlayerControllerOptions["sendDirect"];
  private readonly _uploadFile: PlayerControllerOptions["uploadFile"];
  private readonly _showInputModal: PlayerControllerOptions["showInputModal"];
  private readonly _gamestate: PlayerControllerOptions["gamestate"];
  private readonly _gamePlayers = usePlayersStore(pinia);
  private readonly _identity = useSessionIdentityStore(pinia);
  private readonly _profile = useProfileStore(pinia);
  private readonly _review = useReviewStore(pinia);
  private readonly _roles = useRoleActivityStore(pinia);
  private readonly _scenario = useScenarioStore(pinia);

  constructor(options: PlayerControllerOptions) {
    this._isSpectator = options.isSpectator;
    this._send = options.send;
    this._sendDirect = options.sendDirect;
    this._uploadFile = options.uploadFile;
    this._showInputModal = options.showInputModal;
    this._gamestate = options.gamestate;
  }

  sendPlayer({ player, property, value }: PlayerUpdatePayload) {
    if (
      this._isSpectator() ||
      property === "reminders" ||
      (property === "stReminders" && !this._review.isReview)
    )
      return;
    const index = this._gamePlayers.players.indexOf(player);
    const gamestate = this._gamestate();
    const staticProperties = ["isAllowRole"];
    if (property === "role") {
      if (!isLegacyRuntimeRole(value)) return;
      if (this._review.isReview || (value.team && value.team === "traveler")) {
        // update local gamestate to remember this player as a traveler
        if (value.team && value.team === "traveler" && gamestate[index])
          gamestate[index].roleId = value.id;
        this._send("player", {
          index,
          property,
          value: value.id,
        });
        if (
          this._review.isReview &&
          value.team != "traveler" &&
          gamestate[index] &&
          gamestate[index].roleId
        )
          delete gamestate[index].roleId;
      } else if (gamestate[index] && gamestate[index].roleId) {
        // player was previously a traveler
        delete gamestate[index].roleId;
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
  _updatePlayer({
    index,
    property,
    value,
  }: {
    index: number;
    property: string;
    value: unknown;
  }) {
    if (!this._isSpectator()) return;
    const player = this._gamePlayers.players[index];
    if (!player) return;
    // special case where a player stops being a traveler
    if (property === "role") {
      if (!value && player.role.team === "traveler") {
        // reset to an unknown role
        this._gamePlayers.update({
          player,
          property: "role",
          value: {},
        });
      } else {
        // load role, first from session, the global, then fail gracefully
        const roleId = typeof value === "string" ? value : "";
        const role =
          this._scenario.roles.get(roleId) || rolesJSONbyId.get(roleId) || {};
        this._gamePlayers.update({
          player,
          property: "role",
          value: role,
        });
      }
    } else if (property === "isSecretVoteless") {
      // if (value === true) {
      this._gamePlayers.update({ player, property, value });
      // 如果是玩家则同时移除投票标记
      if (player.id === this._identity.playerId && value) {
        this._gamePlayers.update({
          player,
          property: "isVoteless",
          value,
        });
      }
      // }
    } else if (property === "isVoteless") {
      if (!player.isSecretVoteless || value)
        this._gamePlayers.update({ player, property, value });
    } else {
      // just update the player otherwise
      this._gamePlayers.update({ player, property, value });
    }
  }

  emptyPlayer({ id }: { id: string }) {
    if (id === "") return; //必须指定玩家
    this._sendDirect(id, "leaveSeat", undefined);
  }

  _updateLeaveSeat() {
    this._identity.claimSeat(-1);
  }

  /**
   * Publish a player pronouns update
   * @param player
   * @param value
   * @param isFromSockets
   */
  sendPlayerPronouns({ player, value, isFromSockets }: PlayerPronounsPayload) {
    //send pronoun only for the seated player or storyteller
    //Do not re-send pronoun data for an update that was recieved from the sockets layer
    if (
      isFromSockets ||
      (this._isSpectator() && this._identity.playerId !== player.id)
    )
      return;
    const index = this._gamePlayers.players.indexOf(player);
    this._send("pronouns", [index, value]);
  }

  /**
   * Update a pronouns based on incoming data.
   * @param index
   * @param value
   * @private
   */
  _updatePlayerPronouns([index, value]: [number, string]): void {
    const player = this._gamePlayers.players[index];
    if (!player) return;

    this._gamePlayers.update({
      player,
      property: "pronouns",
      value,
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
    if (!this._isSpectator()) return;
    if (property !== "using") return;
    if (role !== "wraith" || !this._roles.wraith) return;
    this._sendDirect("host", "usingRole", {
      role,
      value,
      playerId: this._identity.playerId,
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
    if (!this._isSpectator() && property !== "using") return;
    if (this._isSpectator() && property === "using" && !st) return;
    if (
      role !== "wraith" ||
      !["active", "using", "st", "player", "prob", "probMax"].includes(
        property,
      ) ||
      (typeof value !== "boolean" && typeof value !== "number")
    )
      return;
    this._roles.setRole({
      role,
      property: property as WraithProperty,
      value,
      ...(st === true ? { st } : {}),
    });
  }

  /**
   * Update a role status.
   * @param role role to be updated
   * @param property property in the role set to be updated
   * @param value value to be updated
   */
  _updateUsingRole({ role, value, playerId }: LegacyUsingRolePayload): void {
    if (this._isSpectator()) return;
    const index = this._gamePlayers.players.findIndex(
      (player) => player.id === playerId,
    );
    if (index === -1) return;
    const player = this._gamePlayers.players[index];
    if (!player) return;
    if (role === "wraith") {
      if (player.isWraith) {
        this._gamePlayers.update({
          player,
          property: "isUsingWraith",
          value,
        });
      } else {
        this._gamePlayers.update({
          player,
          property: "isWraith",
          value: false,
        });
        this._gamePlayers.update({
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
  uploadAvatar(image: string) {
    this._uploadFile("uploadAvatar", this._identity.playerId, image);
  }

  /**
   * Confirmation on receiving the uploaded image.
   * @param image
   */
  async _avatarReceived(link: string): Promise<void> {
    const playerId = this._identity.playerId;
    const linkId = link.split(".")[0];
    if (playerId != linkId) return;

    this._profile.updatePlayerAvatar(link);
    await this._showInputModal({
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
}
