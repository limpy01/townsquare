import type { LegacyGrimoirePayload } from "@townsquare/contracts/legacy-client-command";
import type { LegacyFeedback } from "@townsquare/contracts/legacy-envelope";
import { pinia } from "../pinia";
import { usePlayersStore } from "../stores/players";
import { useScenarioStore } from "../stores/scenario";
import { rolesJSONbyId } from "./selectors";
import type {
  LegacyRuntimeRole,
  TargetedDistribution,
} from "./session-transport-guards";

type PlayerDeliveryOptions = {
  isSpectator: () => boolean;
  send: (command: string, params: unknown, feedback?: LegacyFeedback) => void;
  sendDirect: (
    playerId: string | null | undefined,
    command: string,
    params: unknown,
    feedback?: LegacyFeedback,
  ) => void;
};

export class SessionPlayerDeliveryController {
  private readonly _isSpectator: () => boolean;
  private readonly _send: PlayerDeliveryOptions["send"];
  private readonly _sendDirect: PlayerDeliveryOptions["sendDirect"];
  private readonly _gamePlayers = usePlayersStore(pinia);
  private readonly _scenario = useScenarioStore(pinia);
  constructor(options: PlayerDeliveryOptions) {
    this._isSpectator = options.isSpectator;
    this._send = options.send;
    this._sendDirect = options.sendDirect;
  }

  distributeRoles() {
    if (this._isSpectator()) return;
    const message: Record<string, [string, unknown]> = {};
    this._gamePlayers.players.forEach((player, index) => {
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
    if (this._isSpectator()) return;
    const message: Record<string, [string, unknown]> = {};
    this._gamePlayers.players.forEach((player, index) => {
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
  distributeBluffs({
    all,
    role,
    seatNum,
    playerId,
  }: TargetedDistribution): void {
    if (this._isSpectator()) return;
    if (!all && !seatNum && !playerId && !role) return;

    if (all) {
      this._send("bluff", this._gamePlayers.bluffs);
      return;
    }
    if (playerId) {
      this._sendDirect(playerId, "bluff", this._gamePlayers.bluffs);
      return;
    }
    if (seatNum) {
      const player = this._gamePlayers.players[seatNum - 1];
      if (!player) return;
      playerId = player.id;
      this._sendDirect(playerId, "bluff", this._gamePlayers.bluffs);
      return;
    }

    let team: "demon" | "minion" | undefined;
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

    const message: Record<string, ["bluff", unknown]> = {};
    this._gamePlayers.players.forEach((player) => {
      if (player.id && player.role && player.role.team == team) {
        if (team === "demon") {
          let lunatic = false;
          player.reminders.forEach((reminder: { role?: unknown }) => {
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
        message[player.id] = ["bluff", this._gamePlayers.bluffs];
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
  _updateBluff(bluffs: LegacyRuntimeRole[]) {
    if (!this._isSpectator()) return;
    this._gamePlayers.replaceBluffs(bluffs);
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
  distributeGrimoire({
    all,
    role,
    seatNum,
    playerId,
  }: TargetedDistribution): void {
    if (this._isSpectator()) return;
    if (!all && !seatNum && !playerId && !role) return;

    const fullGrimoire = !!all || !!playerId ? false : true;

    type GrimoireRoleEntry = [
      { index: number; property: "role"; value: string | undefined },
    ];
    type GrimoireReminderEntry = [
      {
        index: number;
        property: "reminder" | "stReminder";
        value: Array<{ role?: string | undefined }>;
      },
    ];
    type GrimoireMessage = {
      roles: GrimoireRoleEntry[];
      reminders?: GrimoireReminderEntry[];
      stReminders?: GrimoireReminderEntry[];
    };
    if (!role) {
      // not specifying a role
      const grimoire: GrimoireMessage = { roles: [] };
      if (fullGrimoire) {
        grimoire.reminders = [];
      }
      if (all) {
        grimoire.stReminders = [];
      }
      this._gamePlayers.players.forEach((player, index) => {
        grimoire.roles.push([
          { index, property: "role", value: player.role.id },
        ]);
        if (fullGrimoire) {
          grimoire.reminders?.push([
            { index, property: "reminder", value: player.reminders },
          ]);
        }
        if (all) {
          grimoire.stReminders?.push([
            { index, property: "stReminder", value: player.stReminders },
          ]);
        }
      });
      if (grimoire.roles.length) {
        if (all) this._send("grimoire", grimoire);
        if (playerId) this._sendDirect(playerId, "grimoire", grimoire);
        if (seatNum) {
          const player = this._gamePlayers.players[seatNum - 1];
          if (!player) return;
          playerId = player.id;
          this._sendDirect(playerId, "grimoire", grimoire);
        }
      }
    } else {
      // send all roles and reminders when requesting full grimoire (i.e. widow or spy)
      const directMessage: Record<string, ["grimoire", GrimoireMessage]> = {};
      this._gamePlayers.players.forEach((player) => {
        if (player.id && player.role && player.role.id == role) {
          directMessage[player.id] = ["grimoire", { roles: [], reminders: [] }];
          this._gamePlayers.players.forEach((player2, index) => {
            directMessage[player.id]?.[1].roles.push([
              { index, property: "role", value: player2.role.id },
            ]);
            if (fullGrimoire) {
              directMessage[player.id]?.[1].reminders?.push([
                { index, property: "reminder", value: player2.reminders },
              ]);
            }
          });
        }
      });
      if (Object.keys(directMessage).length) {
        this._send("direct", directMessage);
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
      const role: LegacyRuntimeRole = (update.value &&
        this._scenario.roles.get(update.value)) ||
        (update.value && rolesJSONbyId.get(update.value)) || { id: "" };
      if (role.team === "traveler") return;
      const player = this._gamePlayers.players[update.index];
      if (!player) return;
      this._gamePlayers.update({
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
        const player = this._gamePlayers.players[update.index];
        if (!player) return;
        const value: Array<{ role?: string | undefined }> = Array.from(
          player.reminders,
        );
        update.value.forEach((reminder) => {
          if (reminder.role === "custom") return;
          value.push(reminder);
        });
        this._gamePlayers.update({
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
        const player = this._gamePlayers.players[update.index];
        if (!player) return;
        this._gamePlayers.update({
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
}
