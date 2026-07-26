// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { mount } from "@vue/test-utils";
import TownSquare from "./TownSquare.vue";
import { gameEvents } from "../store/game-events";
import { usePlayersStore } from "../stores/players";
import { useSessionIdentityStore } from "../stores/session-identity";
import { useVotingStore } from "../stores/voting";

describe("TownSquare", () => {
  let testPinia: Pinia;

  beforeEach(() => {
    testPinia = createPinia();
    setActivePinia(testPinia);
  });

  it("removes a seat directly and clears a nomination that includes it", async () => {
    const players = usePlayersStore(testPinia);
    const session = useSessionIdentityStore(testPinia);
    const voting = useVotingStore(testPinia);
    players.setPlayers([
      { id: "one", name: "One", role: {} },
      { id: "two", name: "Two", role: {} },
    ]);
    session.setSpectator(false);
    voting.setNomination([0, 1], {
      isSecretVote: false,
      claimedSeat: -1,
    });
    const received: Array<{ type: string; payload?: unknown }> = [];
    const unsubscribe = gameEvents.subscribe((event) => received.push(event));
    const wrapper = mount(TownSquare, {
      global: {
        plugins: [testPinia],
        stubs: {
          Player: {
            template:
              "<button class=\"remove-seat\" @click=\"$emit('trigger', ['removePlayer'])\" />",
          },
          Token: true,
          ReminderModal: true,
          RoleModal: true,
          "font-awesome-icon": true,
        },
      },
    });

    await wrapper.findAll(".remove-seat")[0]!.trigger("click");
    unsubscribe();

    expect(players.players).toHaveLength(1);
    expect(voting.nomination).toBe(false);
    expect(received).toContainEqual({ type: "session/nomination" });
    expect(received).toContainEqual({ type: "players/remove", payload: 0 });
  });
});
