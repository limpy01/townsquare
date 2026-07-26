import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGrimoireStore } from "../stores/grimoire";
import { usePlayersStore } from "../stores/players";
import { useSessionIdentityStore } from "../stores/session-identity";
import { useVotingStore } from "../stores/voting";
import { gameEvents } from "../store/game-events";
import { createPlayerStateActions } from "./player-state-actions";

describe("player state actions", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("applies public death and vote transitions through Pinia and events", () => {
    const players = usePlayersStore();
    const grimoire = useGrimoireStore();
    const session = useSessionIdentityStore();
    const voting = useVotingStore();
    const player = {
      id: "player-1",
      isDead: false,
      isMarked: true,
      isVoteless: false,
      isSecretVoteless: false,
      isAllowRole: true,
      reminders: [],
      stReminders: [],
    };
    players.setPlayers([player]);
    grimoire.toggle("isPublic", true);
    const received = vi.fn();
    const unsubscribe = gameEvents.subscribe(received);
    const actions = createPlayerStateActions({
      player,
      players,
      grimoire,
      session,
      voting,
      closeMenu: vi.fn(),
    });

    actions.toggleStatus();
    actions.toggleVote();
    unsubscribe();

    expect(player.isDead).toBe(true);
    expect(player.isMarked).toBe(false);
    expect(player.isVoteless).toBe(true);
    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({ type: "players/update" }),
      expect.anything(),
    );
  });
});
