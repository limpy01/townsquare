import { emitGameEvent } from "../store/game-events";
import type { useGrimoireStore } from "../stores/grimoire";
import type { MutablePlayer, usePlayersStore } from "../stores/players";
import type { useSessionIdentityStore } from "../stores/session-identity";
import type { useVotingStore } from "../stores/voting";

type PlayerStateActionOptions = {
  player: MutablePlayer;
  players: ReturnType<typeof usePlayersStore>;
  grimoire: ReturnType<typeof useGrimoireStore>;
  session: ReturnType<typeof useSessionIdentityStore>;
  voting: ReturnType<typeof useVotingStore>;
  closeMenu(): void;
};

export function createPlayerStateActions({
  player,
  players,
  grimoire,
  session,
  voting,
  closeMenu,
}: PlayerStateActionOptions) {
  const update = (property: string, value: unknown, close = false) => {
    if (
      session.isSpectator &&
      !["reminders", "stReminders", "pronouns"].includes(property)
    )
      return;
    const payload = { player, property, value };
    players.update(payload);
    emitGameEvent("players/update", payload);
    if (close) closeMenu();
  };
  const toggleStatus = () => {
    if (grimoire.isPublic) {
      if (!player.isDead) {
        update("isDead", true);
        if (player.isMarked) update("isMarked", false);
      } else if (player.isVoteless) {
        update("isVoteless", false);
        update("isDead", false);
      } else update("isVoteless", true);
    } else {
      update("isDead", !player.isDead);
      if (player.isMarked) update("isMarked", false);
      if (player.isVoteless) update("isVoteless", false);
      if (player.isSecretVoteless) {
        update("isSecretVoteless", false);
        update("isVoteless", false);
      }
    }
  };
  const toggleVote = () => {
    if (!player.isDead) return;
    update(
      voting.isSecretVote && !player.isSecretVoteless
        ? "isSecretVoteless"
        : "isVoteless",
      true,
    );
  };
  const toggleAllowRole = () => {
    if (!session.isSpectator) update("isAllowRole", !player.isAllowRole, true);
  };
  const setWraithEnabled = (enabled: boolean) => {
    if (enabled) update("isWraith", true, true);
    else {
      update("isWraith", false, true);
      update("isUsingWraith", false, true);
      update("isAllowRole", true, true);
    }
  };
  const removeReminder = (reminder: { role: string }) => {
    const reminders = Array.isArray(player.reminders)
      ? [...player.reminders]
      : [];
    const index = reminders.indexOf(reminder);
    if (index !== -1) reminders.splice(index, 1);
    update("reminders", reminders, true);
    if (session.isSpectator) return;
    if (reminder.role === "custom") return;
    const stReminders = Array.isArray(player.stReminders)
      ? [...player.stReminders]
      : [];
    const stIndex = stReminders.findIndex(
      (item) => item?.role === reminder.role,
    );
    if (stIndex === -1) return;
    stReminders.splice(stIndex, 1);
    update("stReminders", stReminders, true);
  };
  return {
    update,
    toggleStatus,
    toggleVote,
    toggleAllowRole,
    setWraithEnabled,
    removeReminder,
  };
}
